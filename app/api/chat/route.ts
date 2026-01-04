import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: NextRequest) {
  try {
    const { message, sessionId } = await request.json();

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      );
    }

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Create a message with computer use capabilities
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      tools: [
        {
          type: 'computer_20241022',
          name: 'computer',
          display_width_px: 1920,
          display_height_px: 1080,
        },
        {
          type: 'text_editor_20241022',
          name: 'str_replace_editor',
        },
        {
          type: 'bash_20241022',
          name: 'bash',
        },
      ] as any,
      messages: [
        {
          role: 'user',
          content: message,
        },
      ],
    });

    // Extract the response
    const textContent = response.content.find((block: any) => block.type === 'text');
    const toolUse = response.content.filter((block: any) => block.type === 'tool_use');

    return NextResponse.json({
      success: true,
      message: textContent?.text || 'Processing your request...',
      toolActions: toolUse,
      sessionId: sessionId || Date.now().toString(),
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to process request',
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
