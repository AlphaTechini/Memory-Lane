<script>
    import { onMount } from "svelte";
    import { apiCall } from "$lib/auth.js";

    let { userName = "Margaret" } = $props();

    let chatInput = $state("");
    // svelte-ignore state_referenced_locally
    let messages = $state([
        {
            role: "guide",
            text: `Hello ${userName}! It's so good to see you. How are you feeling this morning?`,
        },
    ]);
    let isLoading = $state(false);
    let messagesContainer;

    function scrollToBottom() {
        if (messagesContainer) {
            setTimeout(() => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, 50);
        }
    }

    async function handleSendMessage() {
        if (!chatInput.trim() || isLoading) return;

        const userMessage = chatInput.trim();
        messages = [...messages, { role: "user", text: userMessage }];
        chatInput = "";
        isLoading = true;
        scrollToBottom();

        try {
            // Note: This API call connects to the existing Sensay interaction endpoint
            // Currently using a hardcoded replicaId for demonstration. In a full implementation,
            // this would be dynamic based on the user's assigned AI guide.
            const response = await apiCall("/api/replicas/interact", {
                method: "POST",
                body: JSON.stringify({
                    replicaId: "default-guide", // Placeholder
                    messages: messages.map((m) => ({
                        role: m.role === "guide" ? "assistant" : "user",
                        content: m.text,
                    })),
                }),
            });

            if (response.ok) {
                const data = await response.json();
                messages = [
                    ...messages,
                    {
                        role: "guide",
                        text:
                            data.reply ||
                            "I'm having trouble connecting right now, but I'm here for you.",
                    },
                ];
            } else {
                // For demonstration purposes if backend is missing replica
                setTimeout(() => {
                    messages = [
                        ...messages,
                        {
                            role: "guide",
                            text: "That is wonderful to hear! Would you like to look at some photos of your grandchildren?",
                        },
                    ];
                    scrollToBottom();
                }, 1000);
            }
        } catch (error) {
            console.error("Error sending message:", error);
            messages = [
                ...messages,
                {
                    role: "guide",
                    text: "I'm sorry, I couldn't understand that right now.",
                },
            ];
        } finally {
            isLoading = false;
            scrollToBottom();
        }
    }
</script>

<div
    class="flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-[0_10px_25px_-5px_rgba(15,73,189,0.1)] overflow-hidden border border-slate-100 dark:border-slate-800 h-[70vh] min-h-[600px] lg:h-auto"
>
    <!-- Header -->
    <div
        class="bg-accent-sage/10 p-8 flex items-center gap-6 border-b border-accent-sage/20"
    >
        <div class="relative">
            <img
                alt="Professional female guide smiling warmly"
                class="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-slate-800 shadow-md"
                src="/images/patient-portal/guide.jpg"
            />
            <div
                class="absolute bottom-1 right-1 w-6 h-6 bg-green-500 rounded-full border-4 border-white dark:border-slate-800"
            ></div>
        </div>
        <div>
            <h3
                class="text-3xl font-bold text-slate-900 dark:text-white font-serif"
            >
                Talk to Anna
            </h3>
            <p class="text-xl text-accent-sage font-medium mt-1">
                Your Personal Guide
            </p>
        </div>
    </div>

    <!-- Chat Area -->
    <div
        class="flex-1 overflow-y-auto p-4 sm:p-8 flex flex-col gap-6 sm:gap-8 bg-slate-50 dark:bg-slate-900/50"
        bind:this={messagesContainer}
    >
        {#each messages as msg}
            {#if msg.role === "guide"}
                <!-- Guide Message -->
                <div class="flex gap-4 items-start max-w-[95%] sm:max-w-[90%]">
                    <div
                        class="w-16 h-16 rounded-full bg-accent-sage/20 flex-shrink-0 flex items-center justify-center text-accent-sage"
                    >
                        <span class="material-symbols-outlined text-3xl"
                            >support_agent</span
                        >
                    </div>
                    <div
                        class="bg-white dark:bg-slate-800 p-6 rounded-2xl rounded-tl-none shadow-sm border border-slate-100 dark:border-slate-700"
                    >
                        <p
                            class="text-xl sm:text-2xl leading-relaxed text-slate-800 dark:text-slate-200"
                        >
                            {msg.text}
                        </p>
                    </div>
                </div>
            {:else}
                <!-- User Message -->
                <div
                    class="flex gap-4 items-start max-w-[95%] sm:max-w-[90%] self-end flex-row-reverse"
                >
                    <div
                        class="w-16 h-16 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center text-primary dark:text-blue-400"
                    >
                        <span class="material-symbols-outlined text-3xl"
                            >person</span
                        >
                    </div>
                    <div
                        class="bg-primary/10 dark:bg-primary/20 p-6 rounded-2xl rounded-tr-none"
                    >
                        <p
                            class="text-xl sm:text-2xl leading-relaxed text-slate-900 dark:text-white"
                        >
                            {msg.text}
                        </p>
                    </div>
                </div>
            {/if}
        {/each}

        {#if isLoading}
            <div class="flex gap-4 items-start max-w-[90%]">
                <div
                    class="w-16 h-16 rounded-full bg-accent-sage/20 flex-shrink-0 flex items-center justify-center text-accent-sage animate-pulse"
                >
                    <span class="material-symbols-outlined text-3xl"
                        >support_agent</span
                    >
                </div>
                <div
                    class="bg-white dark:bg-slate-800 p-6 py-8 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2"
                >
                    <div
                        class="w-3 h-3 bg-slate-300 rounded-full animate-bounce"
                    ></div>
                    <div
                        class="w-3 h-3 bg-slate-300 rounded-full animate-bounce delay-100"
                    ></div>
                    <div
                        class="w-3 h-3 bg-slate-300 rounded-full animate-bounce delay-200"
                    ></div>
                </div>
            </div>
        {/if}
    </div>

    <!-- Input Area -->
    <div
        class="p-4 sm:p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800"
    >
        <form
            class="flex flex-col gap-4"
            onsubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
            }}
        >
            <label class="sr-only" for="chat-input">Type your message</label>
            <textarea
                bind:value={chatInput}
                onkeydown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                    }
                }}
                class="w-full text-xl sm:text-2xl p-6 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-primary dark:focus:border-blue-500 focus:ring-4 focus:ring-primary/20 dark:text-white transition-all resize-none min-h-[120px] placeholder:text-slate-400 dark:placeholder:text-slate-500"
                id="chat-input"
                placeholder="Type here to talk to Anna..."
            ></textarea>
            <button
                disabled={isLoading}
                class="w-full bg-primary hover:bg-primary-hover disabled:bg-slate-400 disabled:cursor-not-allowed text-white text-xl sm:text-2xl font-bold py-6 rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-[0.99] flex items-center justify-center gap-3"
                type="submit"
            >
                <span>Send Message</span>
                <span class="material-symbols-outlined text-3xl">send</span>
            </button>
        </form>
    </div>
</div>
