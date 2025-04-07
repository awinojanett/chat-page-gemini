#Voice-Enabled Chat Page with LLM Integration

This project is a Chat Page that takes voice inputs from users, which are processed through a Large Language Model (LLM) to generate responses. 
It replies via both text and speech, creating a natural and accessible conversation experience.


##Features

•	Voice Input: Users can speak directly to the app using the browser’s built-in Web Speech API.

•	LLM Integration: User input is sent to Google’s Gemini 1.5 Flash API to generate a smart, conversational response.

•	Speech Output: Assistant replies are read aloud using the Speech Synthesis API.

##Technologies Used
	
React	- Frontend UI framework

Web Speech API	- To handle voice recognition (speech-to-text)

Speech Synthesis API	- To read out assistant responses (text-to-speech)

Gemini LLM API (Google)	- To generate intelligent chat responses

HTML/CSS	- Styling and layout


##Implementation Details

•	Voice Input:

o	Implemented using the SpeechRecognition interface (Web Speech API).

o	User speech is continuously transcribed until paused or processed.


•	LLM Integration:

o	Gemini API is called via a POST request with user input.

o	Response text is extracted and displayed on the chat interface.


•	Voice Output:

o	When the assistant responds, the text is passed to window.speechSynthesis to be read out loud.


##How It Works

1.	User speaks into the microphone.
2.	SpeechRecognition API converts the spoken input to text.
3.	The text is sent to Gemini API, which returns a response.
4.	The response is shown in the chat window and read out using SpeechSynthesis.
