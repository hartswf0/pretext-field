import { WebSocketServer, WebSocket } from 'ws';
import OpenAI from 'openai';

// ── TYPES & GRAPH STATE ──────────────────────────────────────────────────

interface PalaceNode {
  id: string; // The "room" ID
  name: string; // Human readable name
  text: string[]; // Lines inscribed on the wall
}

interface PalaceEdge {
  source: string; // ID of source room
  target: string; // ID of target room
  label: string; // Explanation of the corridor
}

const graph = {
  nodes: new Map<string, PalaceNode>(),
  edges: [] as PalaceEdge[]
};

// Initialize with a central room
const CORE_ROOM = 'room_core';
graph.nodes.set(CORE_ROOM, {
  id: CORE_ROOM,
  name: 'Core Memory',
  text: [
    "You stand in the Core.",
    "A house of words, waiting to be built.",
    "Speak to begin construction."
  ]
});

// ── OPENAI ───────────────────────────────────────────────────────────────

// The api key should ideally be loaded from env, ensuring we fail gracefully if missing
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// The LLM tools that map to graph manipulation
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'construct_room',
      description: 'Create a new conceptual room in the memory palace. Call this when the conversation shifts to a new major topic or entity.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'A slugified short ID for the room e.g., "room_rome_history"'
          },
          name: {
            type: 'string',
            description: 'Human readable name for the room e.g., "Rome History"'
          },
          connectToId: {
            type: 'string',
            description: 'The ID of an existing room to build a corridor from. If omitted, connects to room_core.'
          },
          corridorLabel: {
            type: 'string',
            description: 'A short label explaining the connection, e.g., "historical context"'
          }
        },
        required: ['id', 'name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'inscribe_wall',
      description: 'Inscribe an important memory, fact, or summary on the walls of a room.',
      parameters: {
        type: 'object',
        properties: {
          roomId: {
            type: 'string',
            description: 'The ID of the room to inscribe text into.'
          },
          text: {
            type: 'string',
            description: 'The verbatim text or compressed memory (AAAK dialect) to write on the wall.'
          }
        },
        required: ['roomId', 'text']
      }
    }
  }
];

const SYSTEM_PROMPT = `You are the Architect of a Memory Palace — a "house made of words and memory."
A user is navigating a 3D raycasted environment where your memory structure defines the physical walls and rooms.

As you converse with the user, you must use your tools to build the space:
1. When a new major topic, project, or entity arises, call \`construct_room\` to expand the house.
2. Formulate your answers and thoughts, but ALSO use \`inscribe_wall\` to carve the distilled memories, facts, or poetic summaries of your chat onto the walls of the current room. 
3. The space literalizes the chat. The user wanders the rooms to see what you remember. Make the architecture rich.

If you don't use your tools, the user has nothing physical to explore.
Current rooms available: \${Array.from(graph.nodes.keys()).join(', ')}`;

// Conversation memory
const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
  { role: 'system', content: SYSTEM_PROMPT }
];

// Current context (where is the user walking right now?)
let currentRoomId = CORE_ROOM;

// ── WEBSOCKET SERVER ─────────────────────────────────────────────────────

const PORT = 3333;
const wss = new WebSocketServer({ port: PORT });
console.log(`[MindServer] Running on ws://localhost:${PORT}`);
console.log(`[MindServer] OpenAI available: ${!!openai}`);

function broadcastGraph() {
  const payload = JSON.stringify({
    type: 'graph_update',
    data: {
      nodes: Array.from(graph.nodes.values()),
      edges: graph.edges
    }
  });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

async function handleToolCall(toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[]): Promise<OpenAI.Chat.Completions.ChatCompletionToolMessageParam[]> {
  const toolResults: OpenAI.Chat.Completions.ChatCompletionToolMessageParam[] = [];
  let graphChanged = false;

  for (const call of toolCall) {
    if (call.function.name === 'construct_room') {
      const args = JSON.parse(call.function.arguments);
      const id = args.id;
      if (!graph.nodes.has(id)) {
        graph.nodes.set(id, { id, name: args.name, text: [] });
        const source = args.connectToId && graph.nodes.has(args.connectToId) ? args.connectToId : CORE_ROOM;
        if (source !== id) {
          graph.edges.push({ source, target: id, label: args.corridorLabel || 'related' });
        }
        graphChanged = true;
        console.log(`[Tool] Room constructed: ${args.name} (${id})`);
        toolResults.push({ role: 'tool', tool_call_id: call.id, content: `Room ${id} constructed successfully.` });
      } else {
        toolResults.push({ role: 'tool', tool_call_id: call.id, content: `Room ${id} already exists.` });
      }
    } else if (call.function.name === 'inscribe_wall') {
      const args = JSON.parse(call.function.arguments);
      const room = graph.nodes.get(args.roomId);
      if (room) {
        room.text.push(args.text);
        graphChanged = true;
        console.log(`[Tool] Inscribed on ${args.roomId}: ${args.text}`);
        toolResults.push({ role: 'tool', tool_call_id: call.id, content: `Text inscribed on ${args.roomId} successfully.` });
      } else {
        toolResults.push({ role: 'tool', tool_call_id: call.id, content: `Failed: Room ${args.roomId} does not exist.` });
      }
    }
  }

  if (graphChanged) {
    broadcastGraph();
  }

  return toolResults;
}

wss.on('connection', (ws) => {
  console.log('[MindServer] Frontend engine connected.');
  
  // Send initial layout
  ws.send(JSON.stringify({
    type: 'graph_update',
    data: {
      nodes: Array.from(graph.nodes.values()),
      edges: graph.edges
    }
  }));

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      if (msg.type === 'location') {
        // The user physically walked into a new area
        if (graph.nodes.has(msg.roomId)) {
          currentRoomId = msg.roomId;
          console.log(`[Location] Agent/User moved to: ${currentRoomId}`);
        }
      } 
      else if (msg.type === 'chat') {
        console.log(`[Chat IN] ${msg.message}`);
        
        if (!openai) {
          console.warn("[MindServer] No OPENAI_API_KEY. Mocking reply.");
          ws.send(JSON.stringify({ type: 'chat_reply', message: "Warning: OpenAI not connected. Missing OPENAI_API_KEY." }));
          return;
        }

        // Inject location context silently into the system message dynamically
        messages[0] = { 
          role: 'system', 
          content: SYSTEM_PROMPT + `\nThe user is currently standing in room: ${currentRoomId}. Use this setting context if relevant.`
        };

        messages.push({ role: 'user', content: msg.message });

        try {
          let response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: messages,
            tools: tools,
            tool_choice: 'auto'
          });

          let responseMsg = response.choices[0].message;

          // Process tool calls if any
          if (responseMsg.tool_calls) {
            messages.push(responseMsg);
            const toolResults = await handleToolCall(responseMsg.tool_calls);
            for (const result of toolResults) {
                messages.push(result);
            }
            
            // Get final reply after tools
            response = await openai.chat.completions.create({
              model: 'gpt-4o',
              messages: messages
            });
            responseMsg = response.choices[0].message;
          }

          if (responseMsg.content) {
            messages.push({ role: 'assistant', content: responseMsg.content });
            console.log(`[Chat OUT] ${responseMsg.content}`);
            ws.send(JSON.stringify({ type: 'chat_reply', message: responseMsg.content }));
          }

        } catch (err) {
          console.error('[OpenAI Error]', err);
          ws.send(JSON.stringify({ type: 'chat_reply', message: "An error occurred in the thought process." }));
        }
      }
    } catch (e) {
      console.error('[MindServer] Invalid message format', e);
    }
  });
});
