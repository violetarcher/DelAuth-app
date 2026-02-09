import { NextRequest, NextResponse } from 'next/server'
import { getSession, getAccessToken } from '@auth0/nextjs-auth0'
import { getOpenAIClient, getSystemPrompt } from '@/lib/openai/client'
import { agentTools, executeTool, AgentContext } from '@/lib/agent/tools'
import { completeCIBAFlow } from '@/lib/ciba/guardian'
import { z } from 'zod'

const chatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system', 'tool']),
      content: z.string().nullable().optional(),
      tool_calls: z.any().optional(),
      tool_call_id: z.string().optional(),
    })
  ),
  organizationId: z.string(),
  cibaVerified: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.sub
    const userEmail = session.user.email
    const userName = session.user.name

    // Get user's access token for Management API calls
    let accessToken: string
    try {
      const tokenResult = await getAccessToken()
      if (!tokenResult.accessToken) {
        throw new Error('Access token is undefined')
      }
      accessToken = tokenResult.accessToken
    } catch (error) {
      console.error('Failed to get access token:', error)
      return NextResponse.json(
        { error: 'Failed to get access token' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { messages, organizationId, cibaVerified: clientCibaVerified = false } = chatSchema.parse(body)

    // SECURITY: Never trust client-provided cibaVerified flag
    // CIBA verification is ALWAYS handled server-side
    // This ensures each operation requires fresh approval
    const cibaVerified = false

    if (clientCibaVerified) {
      console.warn('⚠️ Client attempted to set cibaVerified=true, ignoring for security')
    }

    const client = getOpenAIClient()

    // Create agent context for tool execution
    const context: AgentContext = {
      userId,
      organizationId,
      accessToken,
      userEmail,
      userName,
    }

    // Limit conversation context to last 20 messages to prevent old operations from interfering
    // This keeps recent context but prevents the agent from getting confused by operations
    // that happened many messages ago
    const maxContextMessages = 20
    const recentMessages = messages.slice(-maxContextMessages)

    // Prepare messages for OpenAI
    const openaiMessages = [
      {
        role: 'system' as const,
        content: getSystemPrompt(organizationId, userId),
      },
      ...recentMessages.map((msg) => ({
        role: msg.role,
        content: msg.content || '',
        tool_calls: msg.tool_calls,
        tool_call_id: msg.tool_call_id,
      })),
    ]

    // First API call with function calling
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: openaiMessages,
      tools: agentTools as any,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 1500,
    })

    const responseMessage = completion.choices[0].message

    // Check if the model wants to call functions
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      console.log(`\n🤖 OpenAI wants to execute ${responseMessage.tool_calls.length} tool call(s)`)
      console.log(`Tool calls:`, JSON.stringify(responseMessage.tool_calls, null, 2))

      // Detect duplicate tool calls (likely a hallucination or confusion)
      const toolCallTypes = responseMessage.tool_calls.map(tc => tc.function.name)
      const duplicates = toolCallTypes.filter((item, index) => toolCallTypes.indexOf(item) !== index)
      if (duplicates.length > 0) {
        console.warn(`⚠️ WARNING: Duplicate tool calls detected:`, duplicates)
        console.warn(`⚠️ This suggests the agent is confused. Only executing the first instance.`)

        // Remove duplicate tool calls - keep only the first occurrence of each type
        const seenTypes = new Set<string>()
        responseMessage.tool_calls = responseMessage.tool_calls.filter(tc => {
          if (seenTypes.has(tc.function.name)) {
            console.warn(`⚠️ Skipping duplicate call to ${tc.function.name}`)
            return false
          }
          seenTypes.add(tc.function.name)
          return true
        })
      }

      // Execute all tool calls
      const toolResults = []

      for (const toolCall of responseMessage.tool_calls) {
        const functionName = toolCall.function.name
        const functionArgs = JSON.parse(toolCall.function.arguments)

        console.log(
          `Agent executing tool: ${functionName}`,
          JSON.stringify(functionArgs, null, 2)
        )

        // Execute the tool with user context
        const result = await executeTool(
          functionName,
          functionArgs,
          context,
          cibaVerified
        )

        console.log(
          `Tool result: ${functionName}`,
          JSON.stringify(result, null, 2)
        )

        toolResults.push({
          tool_call_id: toolCall.id,
          result,
        })
      }

      // Check if any tool requires CIBA
      const cibaRequired = toolResults.some((r) => r.result.requiresCIBA)

      if (cibaRequired && !cibaVerified) {
        // Handle CIBA verification server-side
        const cibaResultIndex = toolResults.findIndex((r) => r.result.requiresCIBA)
        const cibaResult = toolResults[cibaResultIndex]
        const cibaToolCall = responseMessage.tool_calls![cibaResultIndex]

        console.log('🔐 CIBA required, initiating Guardian Push...')
        console.log('CIBA tool call:', cibaToolCall.function.name, cibaToolCall.id)

        // Send immediate response to inform user
        const encoder = new TextEncoder()
        const stream = new ReadableStream({
          async start(controller) {
            try {
              // Inform user that Guardian Push is being sent
              const message = '🔐 This operation requires Guardian Push verification. Sending notification to your phone...\n\n'
              controller.enqueue(encoder.encode(message))

              // Initiate CIBA flow
              const cibaResponse = await completeCIBAFlow(
                userId,
                `Approve: ${cibaResult.result.cibaOperation}`
              )

              if (!cibaResponse.success) {
                const errorMsg = `❌ Guardian Push ${cibaResponse.error === 'access_denied' ? 'denied' : 'failed'}: ${cibaResponse.error_description || cibaResponse.error}\n`
                controller.enqueue(encoder.encode(errorMsg))
                controller.close()
                return
              }

              console.log('✅ CIBA approved, retrying operation...')
              controller.enqueue(encoder.encode('✅ Guardian Push approved! Executing operation...\n\n'))

              // Retry the specific tool that required CIBA
              const retryResult = await executeTool(
                cibaToolCall.function.name,
                JSON.parse(cibaToolCall.function.arguments),
                context,
                true // cibaVerified
              )

              console.log('Tool result after CIBA:', JSON.stringify(retryResult, null, 2))

              // Update the toolResults array with the successful retry
              toolResults[cibaResultIndex].result = retryResult

              // Build messages with ALL tool results (required by OpenAI)
              const finalMessages = [
                ...openaiMessages,
                {
                  role: 'assistant' as const,
                  content: responseMessage.content || '',
                  tool_calls: responseMessage.tool_calls,
                },
                // Add tool responses for ALL tool calls
                ...toolResults.map((tr) => ({
                  role: 'tool' as const,
                  tool_call_id: tr.tool_call_id,
                  content: JSON.stringify(tr.result),
                })),
              ]

              // Get final response from OpenAI
              const finalStream = await client.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: finalMessages,
                stream: true,
                temperature: 0.7,
                max_tokens: 1500,
              })

              for await (const chunk of finalStream) {
                const text = chunk.choices[0]?.delta?.content || ''
                if (text) {
                  controller.enqueue(encoder.encode(text))
                }
              }

              controller.close()
            } catch (error: any) {
              console.error('CIBA flow error:', error)
              const errorDetails = error?.message || error?.toString() || 'Unknown error'
              console.error('Error details:', errorDetails)
              const errorMsg = `❌ An error occurred during verification: ${errorDetails}\n\nPlease try again.\n`
              controller.enqueue(encoder.encode(errorMsg))
              controller.close()
            }
          },
        })

        return new NextResponse(stream, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Transfer-Encoding': 'chunked',
          },
        })
      }

      // Add assistant message with tool calls
      const updatedMessages = [
        ...openaiMessages,
        {
          role: 'assistant' as const,
          content: responseMessage.content || '',
          tool_calls: responseMessage.tool_calls,
        },
        // Add tool results
        ...toolResults.map((tr) => ({
          role: 'tool' as const,
          tool_call_id: tr.tool_call_id,
          content: JSON.stringify(tr.result),
        })),
      ]

      // Second API call with tool results - stream the final response
      const stream = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: updatedMessages,
        stream: true,
        temperature: 0.7,
        max_tokens: 1500,
      })

      // Stream the response
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              const text = chunk.choices[0]?.delta?.content || ''
              if (text) {
                controller.enqueue(encoder.encode(text))
              }
            }
            controller.close()
          } catch (error) {
            console.error('Streaming error:', error)
            controller.error(error)
          }
        },
      })

      return new NextResponse(readable, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked',
        },
      })
    }

    // No tool calls - stream direct response
    const stream = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: openaiMessages,
      stream: true,
      temperature: 0.7,
      max_tokens: 1500,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || ''
            if (text) {
              controller.enqueue(encoder.encode(text))
            }
          }
          controller.close()
        } catch (error) {
          console.error('Streaming error:', error)
          controller.error(error)
        }
      },
    })

    return new NextResponse(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    )
  }
}
