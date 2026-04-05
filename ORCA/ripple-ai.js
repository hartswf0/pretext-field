/**
 * RIPPLE AI BRIDGE
 * Centralized utility for local LLM integration across the RIPPLE ecosystem.
 */

const RIPPLE_AI = {
    // Default config
    config: {
        model: "llama3",
        get host() {
            return localStorage.getItem('ripple_ai_host') || 'localhost:11434';
        }
    },

    /**
     * Call the Local LLM (Ollama compatible)
     * @param {string} prompt - The user prompt
     * @param {string} system - System instructions
     * @returns {Promise<string>} - The AI response
     */
    async call(prompt, system = "You are an AI assistant in the RIPPLES ecology simulator.") {
        const host = this.config.host;
        const url = `http://${host}/v1/chat/completions`;

        console.log(`[RIPPLE AI] Connecting to ${url}...`);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.config.model,
                    messages: [
                        { role: "system", content: system },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.7,
                    max_tokens: 500
                })
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            return data.choices[0].message.content.trim();
        } catch (error) {
            console.error("[RIPPLE AI] Connection failed:", error);
            throw error;
        }
    },

    /**
     * Test the connection to the configured host
     * @returns {Promise<boolean>}
     */
    async testConnection() {
        try {
            const host = this.config.host;
            const url = `http://${host}/api/tags`; // Ollama specific tag endpoint
            const response = await fetch(url);
            return response.ok;
        } catch (e) {
            return false;
        }
    }
};
