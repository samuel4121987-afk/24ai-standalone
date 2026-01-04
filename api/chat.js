import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, sessionId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
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
      ],
      messages: [
        {
          role: 'user',
          content: message,
        },
      ],
    });

    // Extract the response
    const textContent = response.content.find(block => block.type === 'text');
    const toolUse = response.content.filter(block => block.type === 'tool_use');

    return res.status(200).json({
      success: true,
      message: textContent?.text || 'Processing your request...',
      toolActions: toolUse,
      sessionId: sessionId || Date.now().toString(),
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to process request',
    });
  }
}
