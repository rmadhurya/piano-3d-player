const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const MidiFile = require('midi-file').parseMidi;
const Papa = require('papaparse');
const cors = require('cors'); // Import CORS

const app = express();
const upload = multer({ dest: 'uploads/' });

const csvDir = path.join(__dirname, 'output');
if (!fs.existsSync(csvDir)) {
  fs.mkdirSync(csvDir);
}

// Define your FPS and PPQN values
const FPS = 30; // frames per second
const PPQN = 96; // pulses per quarter note

// Enable CORS for all routes
app.use(cors());

app.post('/api/upload', upload.single('file'), (req, res) => {
  const filePath = path.join(__dirname, req.file.path);

  // Read the uploaded file
  fs.readFile(filePath, (err, midiData) => {
    if (err) {
      console.error('Error reading MIDI file:', err); // Log the error
      return res.status(500).send('Error reading MIDI file.');
    }

    try {
      // Parse the MIDI data with midi-file library
      const parsedMidi = MidiFile(midiData);
      const notesData = [];
      const noteDurations = {}; // Object to keep track of note durations
      
      // Track the absolute time for each note in ticks
      let currentTicks = 0;

      parsedMidi.tracks.forEach((track) => {
        track.forEach((event) => {
          currentTicks += event.deltaTime; // Update the current ticks based on deltaTime

          if (event.type === 'noteOn') {
            // Calculate frames from ticks
            const startFrame = Math.floor((currentTicks / PPQN) * (FPS / 60));
            noteDurations[event.noteNumber] = { startFrame, currentTicks }; // Store the start frame and current ticks
          } else if (event.type === 'noteOff') {
            if (noteDurations[event.noteNumber]) {
              // Calculate duration from noteOn to noteOff
              const durationTicks = currentTicks - noteDurations[event.noteNumber].currentTicks;
              const durationFrames = Math.floor((durationTicks / PPQN) * (FPS / 60));
              
              // Only add notes with duration > 0
              if (durationFrames > 0) {
                notesData.push({
                  note: event.noteNumber,
                  startFrame: noteDurations[event.noteNumber].startFrame,
                  duration: durationFrames
                });
              }
              
              delete noteDurations[event.noteNumber]; // Remove the note from the object after processing
            }
          }
        });
      });

      if (notesData.length === 0) {
        return res.status(400).send('No playable note events found in MIDI file.');
      }

      // Respond with notes data instead of saving as CSV
      res.status(200).json(notesData);
    } catch (parseError) {
      console.error('Error parsing MIDI file:', parseError); // Log the parsing error
      res.status(500).send('Error parsing MIDI file.');
    }
  });
});

// Start the server
app.listen(5000, () => {
  console.log('Server running on http://localhost:5000');
});
