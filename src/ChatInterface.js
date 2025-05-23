import React, { useState, useEffect, useRef, useCallback } from 'react';
import Message from './Message';
import './ChatInterface.css';

const ChatInterface = () => {
    const [messages, setMessages] = useState([]);
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [chatHistory, setChatHistory] = useState([]);
    const [textInput, setTextInput] = useState('');
    const chatBottomRef = useRef(null);
    const recognitionRef = useRef(null);

    const geminiApiKey = 'AIzaSyCKEWMetR__IcsXTuNrKFRMQxJUKtdvQcY';
    const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;

    useEffect(() => {
        if (chatBottomRef.current) {
            chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const speakText = (text) => {
        if (!window.speechSynthesis) return;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 1;
        window.speechSynthesis.speak(utterance);
    };

    const initializeRecognition = useCallback(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error('Speech Recognition not supported');
            return false;
        }

        try {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            let finalTranscript = '';
            let isStoppedManually = false;

            recognition.onstart = () => {
                setIsListening(true);
                finalTranscript = '';
                isStoppedManually = false;
            };

            recognition.onend = () => {
                if (!isStoppedManually && recognitionRef.current) {
                    setTimeout(() => {
                        try {
                            recognition.start();
                        } catch (error) {
                            console.error('Error restarting recognition:', error);
                        }
                    }, 100);
                } else {
                    setIsListening(false);
                }
            };

            recognition.onerror = (event) => {
                if (event.error === 'no-speech') return;
                if (event.error === 'aborted') isStoppedManually = true;
                setIsListening(false);
            };

            recognition.onresult = async (event) => {
                let interimTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript + ' ';
                    } else {
                        interimTranscript += transcript;
                    }
                }

                if (finalTranscript.trim()) {
                    setIsProcessing(true);
                    isStoppedManually = true;
                    recognition.stop();
                    addMessage('user', finalTranscript.trim());
                    await processUserInput(finalTranscript.trim());
                    isStoppedManually = false;
                    if (recognitionRef.current) {
                        try {
                            recognition.start();
                        } catch (error) {
                            console.error('Error restarting recognition after processing:', error);
                        }
                    }
                }
            };

            recognitionRef.current = recognition;
            recognitionRef.current.stopManually = () => {
                isStoppedManually = true;
                recognition.stop();
            };

            return true;
        } catch (error) {
            console.error('Failed to initialize recognition:', error);
            return false;
        }
    }, []);

    const stopRecognition = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stopManually();
            recognitionRef.current = null;
        }
        setIsListening(false);
    }, []);

    const startRecognition = useCallback(() => {
        if (isProcessing) return;

        if (!recognitionRef.current && !initializeRecognition()) {
            addMessage('system', 'Failed to initialize speech recognition. Please try again.');
            return;
        }

        try {
            recognitionRef.current.start();
        } catch (error) {
            console.error('Failed to start recognition:', error);
            stopRecognition();
            addMessage('system', 'Failed to start listening. Please try again.');
        }
    }, [isProcessing, initializeRecognition, stopRecognition]);

    const addMessage = (sender, text, details = {}) => {
        const newMessage = {
            sender,
            text,
            timestamp: Date.now(),
            ...details
        };
        setMessages(prev => [...prev, newMessage]);

        if (sender === 'assistant') {
            speakText(text);
        }

        if (sender === 'user' || sender === 'assistant') {
            setChatHistory(prev => [...prev, {
                role: sender === 'user' ? 'user' : 'model',
                content: text
            }].slice(-10));
        }
    };

    const handleTextSubmit = async (e) => {
        e.preventDefault();
        if (!textInput.trim() || isProcessing) return;

        const userInput = textInput.trim();
        setTextInput('');
        addMessage('user', userInput);
        setIsProcessing(true);
        await processUserInput(userInput);
    };

    const processUserInput = async (input, retryCount = 0) => {
        if (!geminiApiKey) {
            addMessage('system', 'API key not configured.');
            return;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
            const response = await fetch(`${API_URL}?key=${geminiApiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: input }] }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 2048,
                        topP: 0.8,
                        topK: 40
                    }
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'API request failed');
            }

            const data = await response.json();
            const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

            if (!responseText) {
                throw new Error('Empty response from API');
            }

            addMessage('assistant', responseText);
        } catch (error) {
            console.error('API Error:', error);
            if (error.name === 'AbortError') {
                addMessage('system', 'Request timed out. Please try again.');
            } else if (retryCount < MAX_RETRIES) {
                console.log(`Retrying (${retryCount + 1}/${MAX_RETRIES})...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                return processUserInput(input, retryCount + 1);
            } else {
                addMessage('system', `Error: ${error.message}. Please try again.`);
            }
        } finally {
            setIsProcessing(false);
        }
    };

    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
                recognitionRef.current = null;
            }
        };
    }, []);

    return (
        <div className="chat-interface">
            <div className="chat-header">
                <h1>Chat Page</h1>
                <p>Click Start to begin speaking</p>
            </div>

            <div className="chat-messages" ref={chatBottomRef}>
                {messages.map((message, index) => (
                    <Message key={index} message={message} />
                ))}
            </div>

            <div className="input-section">
                <form onSubmit={handleTextSubmit} className="text-input-form">
                    <input
                        type="text"
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        placeholder="Type your message here..."
                        disabled={isProcessing}
                        className="text-input"
                    />
                    <button
                        type="submit"
                        disabled={isProcessing || !textInput.trim()}
                        className="send-button"
                    >
                        Send
                    </button>
                </form>

                <div className="voice-controls">
                    <div className="status-text">
                        {isProcessing ? 'Processing...' : isListening ? 'Listening...' : 'Ready'}
                    </div>
                    <div className="control-buttons">
                        <button
                            onClick={startRecognition}
                            disabled={isListening || isProcessing}
                            className="start-button"
                        >
                            Start
                        </button>
                        <button
                            onClick={stopRecognition}
                            disabled={!isListening || isProcessing}
                            className="stop-button"
                        >
                            Stop
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatInterface;
