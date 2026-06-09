import { GoogleGenerativeAI } from '@google/generative-ai';
import { kv } from '@vercel/kv';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const MEM_KEY = 'prasanna_twin_memories';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    // Load memories
    try {
      const raw = await kv.get(MEM_KEY);
      return res.json({ memories: raw ? JSON.parse(raw) : [] });
    } catch {
      return res.json({ memories: [] });
    }
  }

  if (req.method === 'DELETE') {
    // Clear all memories OR delete one by id
    const { id } = req.body || {};
    try {
      if (id) {
        const raw = await kv.get(MEM_KEY);
        const memories = raw ? JSON.parse(raw) : [];
        const filtered = memories.filter(m => m.id !== id);
        await kv.set(MEM_KEY, JSON.stringify(filtered));
        return res.json({ ok: true, memories: filtered });
      } else {
        await kv.set(MEM_KEY, JSON.stringify([]));
        return res.json({ ok: true, memories: [] });
      }
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    const { action } = req.body;

    // ── SAVE MEMORY ──────────────────────────────────────────────────
    if (action === 'save_memory') {
      const { item } = req.body;
      try {
        const raw = await kv.get(MEM_KEY);
        let memories = raw ? JSON.parse(raw) : [];
        memories.unshift({ id: Date.now(), ...item });
        if (memories.length > 60) memories = memories.slice(0, 60);
        await kv.set(MEM_KEY, JSON.stringify(memories));
        return res.json({ ok: true, memories });
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }

    // ── EXTRACT LEARNINGS ─────────────────────────────────────────────
    if (action === 'extract') {
      const { userMsg, aiReply } = req.body;
      const prompt = `You are reading a conversation between Prasanna and his AI digital twin. Extract any NEW facts worth remembering about Prasanna's real situation — current projects, people, decisions, frustrations, goals, context. Only extract concrete, specific, useful facts. Ignore generic discussion.

User said: "${String(userMsg).slice(0, 600)}"
Twin replied: "${String(aiReply).slice(0, 600)}"

Return a JSON array (max 3 items, often 0-1). Each item: {"tag": "short category", "text": "one clear sentence fact"}
Categories: project, career, person, decision, frustration, goal, context, preference
If nothing worth remembering, return [].
Return ONLY the JSON array, nothing else.`;

      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(prompt);
        const raw = result.response.text().trim().replace(/```json|```/g, '').trim();
        const items = JSON.parse(raw);
        if (!Array.isArray(items)) return res.json({ items: [] });

        const validItems = items.filter(i => i.tag && i.text);
        if (validItems.length) {
          const existing = await kv.get(MEM_KEY);
          let memories = existing ? JSON.parse(existing) : [];
          for (const item of validItems) {
            memories.unshift({ id: Date.now() + Math.random(), ...item });
          }
          if (memories.length > 60) memories = memories.slice(0, 60);
          await kv.set(MEM_KEY, JSON.stringify(memories));
        }
        return res.json({ items: validItems });
      } catch (e) {
        return res.json({ items: [] });
      }
    }

    // ── MAIN CHAT ─────────────────────────────────────────────────────
    if (action === 'chat') {
      const { messages, system } = req.body;
      try {
        const model = genAI.getGenerativeModel({
          model: 'gemini-2.0-flash',
          systemInstruction: system,
        });
        // Convert Anthropic-style messages to Gemini format
        const history = messages.slice(0, -1).map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));
        const lastMessage = messages[messages.length - 1].content;
        const chat = model.startChat({ history });
        const result = await chat.sendMessage(lastMessage);
        const text = result.response.text();
        // Return in Anthropic-compatible shape so the frontend needs no changes
        return res.json({ content: [{ text }] });
      } catch (e) {
        return res.status(500).json({ error: { type: 'api_error', message: e.message } });
      }
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
