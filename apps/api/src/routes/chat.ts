import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import OpenAI from 'openai';

export const chatRouter = express.Router();

chatRouter.use(authenticateToken);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID;

if (!OPENAI_API_KEY || !OPENAI_ASSISTANT_ID) {
    console.warn('Warning: OPENAI_API_KEY or OPENAI_ASSISTANT_ID not set. Chat feature will not work.');
}

const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

// POST /api/chat - Send a message to the AI assistant
chatRouter.post('/', async (req: AuthRequest, res, next) => {
    try {
        if (!openai) {
            return res.status(503).json({ error: 'AI chat service is not configured' });
        }

        const { message, threadId } = req.body;

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({ error: 'Message is required and must be a non-empty string' });
        }

        let currentThreadId = threadId;

        // Create a new thread if one doesn't exist
        if (!currentThreadId) {
            const thread = await openai.beta.threads.create();
            currentThreadId = thread.id;
        }

        // Add user message to the thread
        await openai.beta.threads.messages.create(currentThreadId, {
            role: 'user',
            content: message,
        });

        // Run the assistant
        const run = await openai.beta.threads.runs.create(currentThreadId, {
            assistant_id: OPENAI_ASSISTANT_ID!,
        });

        // Poll for completion
        let runStatus = await openai.beta.threads.runs.retrieve(currentThreadId, run.id);
        
        while (runStatus.status === 'queued' || runStatus.status === 'in_progress') {
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before checking again
            runStatus = await openai.beta.threads.runs.retrieve(currentThreadId, run.id);
        }

        if (runStatus.status === 'completed') {
            // Retrieve the assistant's messages
            const messages = await openai.beta.threads.messages.list(currentThreadId, {
                limit: 1,
                order: 'desc',
            });

            const assistantMessage = messages.data[0];
            if (assistantMessage && assistantMessage.role === 'assistant') {
                const content = assistantMessage.content[0];
                if (content.type === 'text') {
                    return res.json({
                        response: content.text.value,
                        threadId: currentThreadId,
                    });
                }
            }

            return res.status(500).json({ error: 'Failed to retrieve assistant response' });
        } else if (runStatus.status === 'failed') {
            const errorMessage = runStatus.last_error?.message || 'Assistant run failed';
            console.error('OpenAI Assistant run failed:', runStatus.last_error);
            return res.status(500).json({ error: `AI service error: ${errorMessage}` });
        } else {
            return res.status(500).json({ error: `Unexpected run status: ${runStatus.status}` });
        }
    } catch (error: any) {
        console.error('Chat API error:', error);
        if (error.response) {
            return res.status(500).json({ error: `OpenAI API error: ${error.response.data?.error?.message || 'Unknown error'}` });
        }
        next(error);
    }
});
