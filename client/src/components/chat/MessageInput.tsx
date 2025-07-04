import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useChat } from "@/hooks/useChat";
import { EmojiPicker } from "./EmojiPicker";
import { FileUpload } from "./FileUpload";
import { Send } from "lucide-react";

export function MessageInput() {
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const { sendMessage, sendTypingIndicator, isLoading } = useChat();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const newHeight = Math.min(textarea.scrollHeight, 96); // Max 4 lines
      textarea.style.height = newHeight + "px";
    }
  }, [message]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    
    // Send typing indicator
    sendTypingIndicator(true);
    
    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingIndicator(false);
    }, 1000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if ((message.trim() || selectedFile) && !isLoading) {
      try {
        if (selectedFile) {
          // Convert file to base64 for simple transmission
          const reader = new FileReader();
          reader.onload = () => {
            const fileData = {
              content: message.trim() || `Shared ${selectedFile.type.startsWith('image/') ? 'image' : 'file'}: ${selectedFile.name}`,
              messageType: selectedFile.type.startsWith('image/') ? 'image' : 'file',
              fileUrl: reader.result as string,
              fileName: selectedFile.name,
              fileSize: selectedFile.size,
            };
            sendMessage(fileData.content, {
              messageType: fileData.messageType,
              fileUrl: fileData.fileUrl,
              fileName: fileData.fileName,
              fileSize: fileData.fileSize,
            });
          };
          reader.readAsDataURL(selectedFile);
        } else {
          sendMessage(message.trim());
        }
        
        setMessage("");
        setSelectedFile(null);
        setFilePreview(null);
        sendTypingIndicator(false);
        
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
      } catch (error) {
        console.error('Error sending message:', error);
      }
    }
  };

  const handleFileSelect = (file: File, preview: string | null) => {
    setSelectedFile(file);
    setFilePreview(preview);
  };

  const handleFileClear = () => {
    setSelectedFile(null);
    setFilePreview(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newMessage = message.substring(0, start) + emoji + message.substring(end);
      setMessage(newMessage);
      
      // Focus and set cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    }
  };

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="p-4 border-t border-border bg-background">
        {/* File upload preview */}
        {selectedFile && (
          <div className="mb-3">
            <FileUpload
              onFileSelect={handleFileSelect}
              onClear={handleFileClear}
              selectedFile={selectedFile}
              preview={filePreview}
            />
          </div>
        )}
        
        <div className="flex items-end space-x-3">
          <FileUpload
            onFileSelect={handleFileSelect}
            onClear={handleFileClear}
            selectedFile={null}
            preview={null}
          />
          
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="min-h-[40px] max-h-24 resize-none pr-12"
              rows={1}
            />
            
            <div className="absolute right-2 bottom-2">
              <EmojiPicker onEmojiSelect={insertEmoji} />
            </div>
          </div>
          
          <Button
            type="submit"
            disabled={!message.trim() || isLoading}
            className="h-10 w-10 rounded-full p-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
