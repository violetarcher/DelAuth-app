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
      accessToken = tokenResult.accessToken
    } catch (error) {
      console.error('Failed to get access token:', error)
      return NextResponse.json(
        { error: 'Failed to get access token' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { messages, organizationId, cibaVerified = false } = chatSchema.parse(body)

    const client = getOpenAIClient()

    // Create agent context for tool execution
    const context: AgentContext = {
      userId,
      organizationId,
      accessToken,
      userEmail,
      userName,
    }

    // Prepare messages for OpenAI
    const openaiMessages = [
      {
        role: 'system' as const,
        content: getSystemPrompt(organizationId, userId),
      },
      ...messages.map((msg) => ({
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
        const cibaResult = toolResults.find((r) => r.result.requiresCIBA)

        console.log('🔐 CIBA required, initiating Guardian Push...')

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
                `Approve: ${cibaResult?.result.cibaOperation}`
              )

              if (!cibaResponse.success) {
                const errorMsg = `❌ Guardian Push ${cibaResponse.error === 'access_denied' ? 'denied' : 'failed'}: ${cibaResponse.error_description || cibaResponse.error}\n`
                controller.enqueue(encoder.encode(errorMsg))
                controller.close()
                return
              }

              console.log('✅ CIBA approved, retrying operation...')
              controller.enqueue(encoder.encode('✅ Guardian Push approved! Executing operation...\n\n'))

              // Retry the tool with CIBA verification
              const retryResult = await executeTool(
                responseMessage.tool_calls![0].function.name,
                JSON.parse(responseMessage.tool_calls![0].function.arguments),
                context,
                true // cibaVerified
              )

              console.log('Tool result after CIBA:', JSON.stringify(retryResult, null, 2))

              // Build messages with tool results
              const finalMessages = [
                ...openaiMessages,
                {
                  role: 'assistant' as const,
                  content: responseMessage.content || '',
                  tool_calls: responseMessage.tool_calls,
                },
                {
                  role: 'tool' as const,
                  tool_call_id: responseMessage.tool_calls![0].id,
                  content: JSON.stringify(retryResult),
                },
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
            } catch (error) {
              console.error('CIBA flow error:', error)
              const errorMsg = '❌ An error occurred during verification. Please try again.\n'
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
