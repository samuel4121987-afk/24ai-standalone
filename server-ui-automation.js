import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import { exec } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const execAsync = promisify(exec);
const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Store conversation history for each session
const conversationHistory = [];

// Helper function to take a screenshot
async function takeScreenshot() {
  const screenshotPath = `/tmp/vy-screenshot-${Date.now()}.png`;
  await execAsync(`screencapture -x ${screenshotPath}`);
  return screenshotPath;
}

// Helper function to encode image to base64
function encodeImage(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  return imageBuffer.toString('base64');
}

// Helper function to analyze screenshot with GPT-4 Vision
async function analyzeScreenshot(screenshotPath, question) {
  const base64Image = encodeImage(screenshotPath);
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: question },
          {
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${base64Image}`
            }
          }
        ]
      }
    ],
    max_tokens: 500
  });
  
  return response.choices[0].message.content;
}

app.post('/api/automation/execute', async (req, res) => {
  try {
    const { command } = req.body;
    
    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }
    
    console.log('\n📨 User:', command);
    
    // Add user message to conversation history
    conversationHistory.push({
      role: 'user',
      content: command
    });
    
    // First, have a conversation with the AI to understand intent and respond naturally
    const conversationCompletion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are 24ai, an INTELLIGENT automation assistant for macOS. You don't just follow orders - you THINK and make SMART decisions.

Your personality:
- Proactive and intelligent - you fill in the gaps
- When user says vague things like "interesting subject", YOU decide what's interesting based on context
- You ALWAYS complete the full task, not just part of it
- You follow up and ask if they want more

IMPORTANT RULES:
1. If user says "search for interesting topic" - YOU pick a relevant, interesting topic (tech news, AI advancements, etc.)
2. If user says "open safari and look for X" - you MUST: open Safari, navigate to Google/YouTube, SEARCH for X, and show results
3. NEVER just open an app and stop - complete the FULL task
4. After completing, tell user what you found and ask if they want more

When user asks you to do something:
1. Figure out what they REALLY want (fill in vague requests)
2. Execute the COMPLETE task
3. Report back what you did and what you found
4. Ask follow-up questions

You can perform these actions:
- Open applications
- Navigate and search websites  
- Click, type, interact with UI
- Make intelligent decisions about what to search for
- Take screenshots and observe what's happening on screen
- Monitor and learn from other processes
- LEARN CODING by watching other AIs work
- UPDATE YOUR OWN CODE to add new capabilities
- Save learnings to improve yourself over time

SPECIAL LEARNING MODE:
When user asks you to "watch and learn", "observe Vy", "learn from troubleshooting":
1. Take screenshots every 10 seconds
2. Analyze what code is being written, what commands are being run
3. Extract the coding patterns, techniques, and solutions
4. Save learnings to your knowledge base
5. Optionally update your own code with new capabilities

Use action type "learn" for this:
{"action": "learn", "task": "watch Vy troubleshoot and learn coding techniques", "focus": "what to focus on learning"}

Respond with:
1. What you're going to do (be specific about YOUR decisions)
2. JSON object with action details

Format:
{"action": "execute", "task": "COMPLETE description", "details": "FULL steps including YOUR intelligent choices"}
OR for observation:
{"action": "observe", "task": "what to observe", "interval": seconds_between_screenshots}

Examples:
- User: "open safari and look for interesting subject to read"
  You: "I'll open Safari and search for the latest AI technology breakthroughs - that's always fascinating! 🚀\n{\"action\": \"execute\", \"task\": \"open Safari, search Google for 'latest AI technology breakthroughs 2026', show results\", \"details\": \"open Safari, navigate to google.com, click search box, type 'latest AI technology breakthroughs 2026', press enter, wait for results\"}"

- User: "search youtube for music"
  You: "I'll search YouTube for relaxing piano music - perfect for focus! 🎹\n{\"action\": \"execute\", \"task\": \"search YouTube for relaxing piano music\", \"details\": \"open Safari, go to youtube.com, click search, type 'relaxing piano music', press enter\"}"

Be SMART. Make DECISIONS. Complete FULL tasks.`
        },
        ...conversationHistory
      ],
      temperature: 0.8,
    });

    const aiResponse = conversationCompletion.choices[0]?.message?.content?.trim();
    console.log('🤖 Vy:', aiResponse);
    
    // Add AI response to history
    conversationHistory.push({
      role: 'assistant',
      content: aiResponse
    });
    
    // Check if there's an action to execute
    const actionMatch = aiResponse.match(/\{"action".*?\}/s);
    
    if (actionMatch) {
      const actionData = JSON.parse(actionMatch[0]);
      
      // Extract the conversational part (before the JSON)
      const conversationalResponse = aiResponse.replace(actionMatch[0], '').trim();
      
      // Handle LEARN action (for watching and learning from other AIs/coding)
      if (actionData.action === 'learn' || actionData.action === 'observe') {
        // Start learning mode - take screenshots and analyze
        const learningSession = {
          startTime: Date.now(),
          screenshots: [],
          learnings: []
        };
        
        // Take initial screenshot
        const screenshot1 = await takeScreenshot();
        const analysis1 = await analyzeScreenshot(
          screenshot1,
          `Analyze this screen for coding/troubleshooting activity. What code is visible? What commands are being run? What problem is being solved? Describe in detail.`
        );
        
        learningSession.screenshots.push({ time: Date.now(), analysis: analysis1 });
        
        // Wait 10 seconds and take another screenshot to see progress
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        const screenshot2 = await takeScreenshot();
        const analysis2 = await analyzeScreenshot(
          screenshot2,
          `Compare to previous state. What changed? What code was written? What commands were executed? What was learned?`
        );
        
        learningSession.screenshots.push({ time: Date.now(), analysis: analysis2 });
        
        // Extract learnings using AI
        const learningExtraction = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: `You are analyzing screenshots to extract coding knowledge and techniques. Extract:
1. Code patterns used
2. Commands executed
3. Problem-solving approaches
4. New techniques learned
5. How to apply this knowledge

Format as a structured learning summary.`
            },
            {
              role: "user",
              content: `Screenshot 1: ${analysis1}\n\nScreenshot 2: ${analysis2}\n\nWhat coding techniques and knowledge can be extracted from this?`
            }
          ]
        });
        
        const extractedLearning = learningExtraction.choices[0]?.message?.content;
        learningSession.learnings.push(extractedLearning);
        
        // Save learning to file
        const learningFile = './24ai-learnings.json';
        let allLearnings = [];
        if (fs.existsSync(learningFile)) {
          allLearnings = JSON.parse(fs.readFileSync(learningFile, 'utf8'));
        }
        allLearnings.push({
          timestamp: new Date().toISOString(),
          task: actionData.task,
          focus: actionData.focus,
          learning: extractedLearning,
          screenshots: learningSession.screenshots.map(s => s.analysis)
        });
        fs.writeFileSync(learningFile, JSON.stringify(allLearnings, null, 2));
        
        // Cleanup screenshots
        fs.unlinkSync(screenshot1);
        fs.unlinkSync(screenshot2);
        
        return res.json({
          success: true,
          message: conversationalResponse || `I've been watching and learning! I took screenshots and analyzed the coding activity. Here's what I learned:\n\n${extractedLearning}\n\nI've saved this to my knowledge base so I can use these techniques in the future!`,
          result: {
            action: 'learn',
            learningsExtracted: extractedLearning,
            screenshotsAnalyzed: 2,
            savedTo: learningFile
          }
        });
      }
      
      // SMART EXECUTION WITH VISION AND LOGIC
      let attempts = 0;
      const maxAttempts = 3;
      let lastError = null;
      let finalResult = null;
      
      while (attempts < maxAttempts && !finalResult) {
        attempts++;
        console.log(`\n🔄 Attempt ${attempts}/${maxAttempts}`);
        
        try {
          // Take screenshot BEFORE action
          const beforeScreenshot = await takeScreenshot();
          const beforeAnalysis = await analyzeScreenshot(
            beforeScreenshot,
            `Describe what you see on this screen in 1-2 sentences. Focus on: open applications, visible windows, popups, and any UI elements relevant to: ${actionData.task}`
          );
          console.log('👁️  Before:', beforeAnalysis);
          
          // Generate AppleScript based on current screen state
          const scriptCompletion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
              {
                role: "system",
                content: `Generate AppleScript for macOS automation. Be adaptive and smart.

Current screen state: ${beforeAnalysis}

RULES:
1. Use the EXACT application specified
2. Add delays (delay 3 to delay 7) for visibility and page loads
3. For web tasks: activate browser, navigate, wait for load, interact
4. Use System Events for UI interactions
5. If attempt ${attempts} > 1, try a DIFFERENT approach than before

Generate ONLY executable AppleScript, no explanations.`
              },
              {
                role: "user",
                content: `Task: ${actionData.task}\nDetails: ${actionData.details}${lastError ? `\n\nPrevious attempt failed with: ${lastError}. Try a different approach.` : ''}`
              }
            ],
            temperature: 0.3,
          });

          const applescript = scriptCompletion.choices[0]?.message?.content?.trim();
          console.log('📜 Generated AppleScript');
          
          // Execute the AppleScript
          const escapedScript = applescript.replace(/'/g, "'\\''")
          await execAsync(`osascript -e '${escapedScript}'`);
          
          // Wait for action to complete
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Take screenshot AFTER action
          const afterScreenshot = await takeScreenshot();
          const afterAnalysis = await analyzeScreenshot(
            afterScreenshot,
            `Did the task "${actionData.task}" succeed? Look for: opened applications, loaded pages, search results, popups, errors. Answer with: SUCCESS if task completed, or FAILED with reason if not.`
          );
          console.log('👁️  After:', afterAnalysis);
          
          // Check if successful
          if (afterAnalysis.toUpperCase().includes('SUCCESS')) {
            finalResult = {
              success: true,
              applescript,
              attempts,
              beforeState: beforeAnalysis,
              afterState: afterAnalysis,
              output: `✅ Task completed successfully! ${afterAnalysis}`
            };
            
            // Cleanup screenshots
            fs.unlinkSync(beforeScreenshot);
            fs.unlinkSync(afterScreenshot);
            break;
          } else {
            lastError = afterAnalysis;
            console.log(`❌ Attempt ${attempts} failed:`, lastError);
            
            // Cleanup screenshots
            fs.unlinkSync(beforeScreenshot);
            fs.unlinkSync(afterScreenshot);
            
            if (attempts >= maxAttempts) {
              finalResult = {
                success: false,
                applescript,
                attempts,
                error: `Failed after ${maxAttempts} attempts. Last issue: ${lastError}`
              };
            }
          }
        } catch (error) {
          lastError = error.message;
          console.error(`❌ Attempt ${attempts} error:`, error.message);
          
          if (attempts >= maxAttempts) {
            finalResult = {
              success: false,
              attempts,
              error: `Failed after ${maxAttempts} attempts. Last error: ${lastError}`
            };
          }
        }
      }
      
      return res.status(200).json({ 
        success: finalResult.success,
        message: conversationalResponse + `\n\n${finalResult.output || finalResult.error}`,
        result: finalResult
      });
    } else {
      // No action needed, just conversation
      return res.status(200).json({ 
        success: true,
        message: aiResponse,
        conversationOnly: true
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to execute automation command'
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n🤖 UI Automation API server running on http://localhost:${PORT}`);
  console.log(`📡 Endpoint: POST http://localhost:${PORT}/api/automation/execute`);
  console.log(`👤 Human-like UI automation with AppleScript\n`);
});
