import React, { useState, useRef, useEffect } from "react";
import {
  Plus,
  Search,
  Library,
  FolderClosed,
  LayoutGrid,
  MoreHorizontal,
  Mic,
  AudioLines,
  Image as ImageIcon,
  PenLine,
  Globe,
  Sparkles,
  SidebarClose,
  SidebarOpen,
  Send,
} from "lucide-react";
import "./App.css";

// Sub-Component: SidebarNavItem
const SidebarNavItem = ({ icon: Icon, label }) => {
  return (
    <button className="flex items-center gap-3 w-full hover:bg-[#202020] text-gray-300 hover:text-white text-sm py-2 px-3 rounded-lg transition-colors text-left">
      <Icon size={18} className="text-gray-400" />
      <span>{label}</span>
    </button>
  );
};

// Sub-Component: ActionPill
const ActionPill = ({ icon: Icon, label, iconColor, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 border border-[#3e3e3e] hover:bg-[#2f2f2f] text-gray-300 text-xs py-2 px-4 rounded-full transition-all"
    >
      <Icon size={14} className={iconColor} />
      <span>{label}</span>
    </button>
  );
};

// Main Component: App
const App = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [input, setInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const recentChats = [
    "Resume Rating Feedback",
    "Interview Prep Topics",
    "Single Number in JS",
    "Diet Plan for Fat Loss",
    "Apology Letter Draft",
  ];

  // Auto-scrolls chat window to the newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, loading]);

  // Submits text to our Node Express Backend
  const handleSendMessage = async (textToSend) => {
    const message = textToSend || input;
    if (!message.trim() || loading) return;

    setLoading(true);
    if (!textToSend) setInput(""); // Clear input box if sent from text input

    // Optimistically update frontend UI with user's message
    const updatedHistory = [...chatHistory, { role: "user", content: message }];
    setChatHistory(updatedHistory);

    try {
      const response = await fetch("http://localhost:5000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message,
          history: chatHistory,
        }),
      });

      const data = await response.json();

      if (data.reply) {
        setChatHistory([
          ...updatedHistory,
          { role: "assistant", content: data.reply },
        ]);
      } else {
        setChatHistory([
          ...updatedHistory,
          {
            role: "assistant",
            content: "Error: Empty server payload response.",
          },
        ]);
      }
    } catch (error) {
      console.error("Backend offline or connection broken:", error);
      setChatHistory([
        ...updatedHistory,
        {
          role: "assistant",
          content:
            "Could not connect to backend server. Make sure it is running on port 5000.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setChatHistory([]);
  };

  return (
    <div className="flex h-screen w-screen bg-[#171717] text-[#ececec] font-sans overflow-hidden">
      {/* SIDEBAR */}
      <div
        className={`bg-[#0d0d0d] h-full flex flex-col justify-between transition-all duration-300 ease-in-out ${
          isSidebarOpen ? "w-[260px] p-3" : "w-0 p-0 overflow-hidden"
        }`}
      >
        {/* Top Navigation Options */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between mb-4 px-2">
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 hover:bg-[#202123] rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <SidebarClose size={18} />
            </button>
          </div>

          <button
            onClick={clearChat}
            className="flex items-center gap-3 w-full bg-[#202020] hover:bg-[#2a2a2a] text-white text-sm font-medium py-2.5 px-3 rounded-lg transition-colors text-left mb-2"
          >
            <Plus size={18} />
            <span>New chat</span>
          </button>

          <SidebarNavItem icon={Search} label="Search chats" />
          <SidebarNavItem icon={Library} label="Library" />
          <SidebarNavItem icon={FolderClosed} label="Projects" />
          <SidebarNavItem icon={LayoutGrid} label="Apps" />
          <SidebarNavItem icon={MoreHorizontal} label="More" />
        </div>

        {/* Recent Chat History */}
        <div className="flex-1 overflow-y-auto my-4 px-2">
          <h3 className="text-xs font-semibold text-gray-400 mb-2 px-1">
            Recents
          </h3>
          <div className="space-y-0.5">
            {recentChats.map((chat, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(chat)}
                className="w-full text-left text-sm py-2 px-2 rounded-lg text-gray-300 hover:bg-[#202020] truncate block"
              >
                {chat}
              </button>
            ))}
          </div>
        </div>

        {/* User Account Section */}
        <div className="border-t border-[#202020] pt-3 flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-bold text-white">
              AS
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium text-white truncate max-w-[110px]">
                Ankit Singh
              </span>
              <span className="text-xs text-gray-400">Free</span>
            </div>
          </div>
          <button className="text-xs bg-[#2f2f2f] hover:bg-[#3e3e3e] text-white px-3 py-1.5 rounded-full font-medium transition-colors">
            Upgrade
          </button>
        </div>
      </div>

      {/* MAIN WORKSPACE DISPLAY */}
      <div className="flex-1 flex flex-col relative h-full">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3.5 absolute top-0 left-0 right-0 z-10 bg-[#171717]/80 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 hover:bg-[#2f2f2f] rounded-lg text-gray-400 hover:text-white transition-colors mr-2"
              >
                <SidebarOpen size={18} />
              </button>
            )}
            <button className="flex items-center gap-1 font-semibold text-lg text-gray-200 hover:bg-[#2f2f2f] px-2 py-1 rounded-lg transition-colors">
              ChatGPT{" "}
              <span className="text-gray-500 text-sm font-normal">▼</span>
            </button>
          </div>

          <div className="flex items-center gap-4">
            <button className="flex items-center gap-1.5 bg-[#2f2f2f] hover:bg-[#3e3e3e] text-white text-xs font-medium px-3 py-1.5 rounded-full transition-colors">
              <Sparkles size={14} className="text-blue-400" />
              Upgrade
            </button>
            <button className="w-8 h-8 rounded-full border border-gray-600 flex items-center justify-center text-gray-400 hover:text-white hover:border-white transition-colors">
              <span className="text-sm font-mono">◌</span>
            </button>
          </div>
        </header>

        {/* Dynamic Interface Swap: Thread vs. Landing View */}
        <div className="flex-1 flex flex-col items-center justify-between pt-24 pb-6 px-4 max-w-3xl mx-auto w-full overflow-hidden">
          {chatHistory.length === 0 ? (
            /* DEFAULT LANDING VIEW */
            <div className="flex-1 flex flex-col items-center justify-center w-full">
              <h2 className="text-3xl font-medium text-white mb-6 tracking-tight">
                What's on your mind today?
              </h2>
            </div>
          ) : (
            /* ACTIVE CHAT HISTORY TIMELINE */
            <div className="flex-1 w-full overflow-y-auto space-y-6 mb-4 pr-1 scrollbar-thin">
              {chatHistory.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-4 p-3 rounded-xl max-w-[85%] ${
                    msg.role === "user"
                      ? "bg-[#2f2f2f] ml-auto text-white"
                      : "bg-transparent mr-auto text-gray-200"
                  }`}
                >
                  {msg.role !== "user" && (
                    <div className="w-6 h-6 rounded-full bg-emerald-700 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">
                      AI
                    </div>
                  )}
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-4 p-3 mr-auto text-gray-400 text-sm animate-pulse">
                  <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-[10px] text-white shrink-0">
                    ...
                  </div>
                  <span>Thinking...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* INPUT BAR ZONE */}
          <div className="w-full flex flex-col items-center gap-4">
            {/* Search Bar Capsule */}
            <div className="w-full bg-[#2f2f2f] rounded-3xl p-3 flex flex-col gap-2 shadow-lg border border-[#3e3e3e]">
              <div className="flex items-center justify-between w-full px-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything"
                  className="bg-transparent text-white placeholder-gray-500 focus:outline-none w-full text-base py-1"
                  disabled={loading}
                />
                <div className="flex items-center gap-2 text-gray-400">
                  <button className="p-1.5 hover:text-white transition-colors">
                    <Mic size={18} />
                  </button>
                  <button
                    onClick={() => handleSendMessage()}
                    className={`p-2 rounded-full transition-colors ${
                      input.trim()
                        ? "bg-white text-black hover:bg-gray-200"
                        : "bg-[#202020] text-gray-500"
                    }`}
                  >
                    {input.trim() ? (
                      <Send size={16} />
                    ) : (
                      <AudioLines size={16} />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Prompt Suggestion Chips (Visible only when chat history is clean) */}
            {chatHistory.length === 0 && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <ActionPill
                  icon={ImageIcon}
                  label="Create an image"
                  iconColor="text-purple-400"
                  onClick={() =>
                    handleSendMessage(
                      "Create a beautiful landscape image for me",
                    )
                  }
                />
                <ActionPill
                  icon={PenLine}
                  label="Write or edit"
                  iconColor="text-yellow-500"
                  onClick={() =>
                    handleSendMessage("Help me write an official email draft")
                  }
                />
                <ActionPill
                  icon={Globe}
                  label="Look something up"
                  iconColor="text-blue-400"
                  onClick={() =>
                    handleSendMessage(
                      "What are the top breaking tech news topics today?",
                    )
                  }
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>  
  );
};

export default App;
