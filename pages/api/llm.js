// pages/api/hello.js

// export default function handler(req, res) {
//     res.status(200).json({ text: 'Hello' })
//   }

import { useState } from 'react';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import next from 'next';
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const ELEVEN_LABS_API_KEY = process.env.ELEVEN_LABS_API_KEY;

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    const { pathname, query } = parsedUrl;

    if (pathname === '/send_message') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString(); // convert Buffer to string
      });
      req.on('end', () => {
        const human_input = JSON.parse(body).human_input;
        const message = get_response(human_input);
        res.end(message);
      });
    } else {
      handle(req, res, parsedUrl);
    }
  }).listen(3000, err => {
    if (err) throw err;
    console.log('> Ready on http://localhost:3000');
  });
});

function get_response(human_input) {
  // Add your language model logic here
  const template = `
  ...
  `;

  const chatgpt_chain = LLMChain({
    // your language model parameters
  });

  const output = chatgpt_chain.predict({human_input: human_input});
  return output;
}

function get_voice_message(message) {
  const payload = {
    text: message,
    model_id: 'eleven_monolingual_v1',
    voice_settings: {
      stability: 0.1,
      similarity_boost: 0.1
    }
  };

  const headers = {
    accept: 'audio/mpeg',
    'xi-api-key': ELEVEN_LABS_API_KEY,
    'Content-Type': 'application/json'
  };

  axios.post('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', payload, {headers: headers})
    .then(response => {
      if (response.status === 200 && response.data) {
        fs.writeFileSync('audio.mp3', response.data);
        // play_sound('LLM/audio.mp3');
      }
    })
    .catch(error => {
      console.error(error);
    });
}  
  
  const form = document.querySelector('form');
  const responseMessage = document.getElementById('response_message');

  form.addEventListener('submit', function(e) {
      e.preventDefault();
      const formData = new FormData(form);
      fetch('/send_message', {
          method: 'POST',
          body: formData
      })
      .then(response => response.text())
      .then(data => {
          responseMessage.innerHTML = data;
      });
      form.reset();
  });