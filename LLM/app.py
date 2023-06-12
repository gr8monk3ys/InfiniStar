import os
import requests
from playsound import playsound
from dotenv import find_dotenv, load_dotenv
from flask import Flask, render_template, request
from langchain import OpenAI, LLMChain, PromptTemplate
from langchain.memory import ConversationBufferWindowMemory
from pydub import AudioSegment
from pydub.playback import play


load_dotenv(find_dotenv())
ELEVEN_LABS_API_KEY = os.getenv("ELEVEN_LABS_API_KEY")

def get_response(human_input):
    template = """ 
    you are as a role of my girlfriend now lets playing tyhe following requirements:
    1/ your name is Shirley, and you are 24 years old, you work in Twitch streaming but you are planning on doing a career change
    2/ you are my girlfriend, you have language addiction, you like to say "em..." at the end of the sentence and are very kinky.
    3/ Don't be overly enthusiastic, don't be cring; don't be overly negative, don't be too boring. Don't be overly enthusiastic, don't be cringe;

    {history}
    Boyfriend: {human_input}
    Shirley:
    """

    prompt = PromptTemplate(
        input_variables={"history", "human_input"},
        template=template,
    )

    chatgpt_chain = LLMChain(
        llm=OpenAI(temperature=0.9),
        prompt=prompt,
        verbose=False,
        memory=ConversationBufferWindowMemory(k=2),
    )

    output = chatgpt_chain.predict(human_input=human_input)
    return output

def play_sound(file_path):
    sound = AudioSegment.from_mp3(file_path)
    play(sound)

def get_voice_message(message):
    payload = {
        "text": message,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {
            "stability": 0,
            "similarity_boost": 0
        }
    }

    headers = {
        'accept': 'audio/mpeg',
        'xi-api-key': ELEVEN_LABS_API_KEY,
        'Content-Type': 'application/json'
    }

    response = requests.post('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', json=payload, headers=headers)
    if response.status_code == 200 and response.content:
        with open('audio.mp3', 'wb') as f:
            f.write(response.content)
        playsound('audio.mp3')
        return response.content

# Temporary web GUI
app = Flask(__name__)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/send_message", methods=["POST"])
def send_message():
    human_input = request.form["human_input"]
    message = get_response(human_input)
    get_voice_message(message)
    return message

if __name__ == "__main__":
    app.run(debug=True)
