const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');


// Use cors middleware to enable CORS
app.use(cors());

// Use express.json() middleware to parse JSON request bodies
app.use(express.json());

// After mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
const codeBlockSchema = new mongoose.Schema({
    id: String,
    title: String,
    code: String,
});

const CodeBlock = mongoose.model('CodeBlock', codeBlockSchema);
function generateRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

async function main() {
    // Start the in-memory MongoDB server
    const mongod = await MongoMemoryServer.create();

    // Get the connection string
    const uri = mongod.getUri();

    // Connect to the database (using Mongoose in this example)
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    console.log('Connected to the database!');

    // You can now perform database operations with Mongoose or the MongoDB driver...

    // When you're done, disconnect and stop the in-memory server
    // await mongoose.disconnect();
    // await mongod.stop();

    seedDatabase();
}

main().catch(err => console.error(err));

async function seedDatabase() {
    const initialCodeBlocks = [
        { id: generateRandomString(12), title: 'Hello World', code: 'console.log("Hello, World!");', description: 'A basic example of a Hello World program.' },
        { id: generateRandomString(12), title: 'For Loop', code: 'for (let i = 0; i < 5; i++) { console.log(i); }', description: 'Example of a for loop in JavaScript.' },
        // Add more initial code blocks as needed
    ];

    for (const block of initialCodeBlocks) {
        const newBlock = new CodeBlock(block);
        await newBlock.save();
    }

    console.log('Database has been seeded with initial data.');
}





console.log('hello')



const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

app.get('/api/codeblocks', async (req, res) => {
    const codeBlocks = await CodeBlock.find();
    res.json(codeBlocks);
});

app.get('/api/codeblocks/:id', async (req, res) => {
    const codeBlock = await CodeBlock.findOne({ id: req.params.id });
    if (codeBlock) {
        res.json(codeBlock);
    } else {
        res.status(404).send('Code block not found');
    }
});


app.post('/api/codeblocksadd', async (req, res) => {
    const { title, code } = req.body;

    // Assuming 'CodeBlock' is your Mongoose model for code blocks
    const newCodeBlock = new CodeBlock({ id: generateRandomString(12), title, code });

    try {
        await newCodeBlock.save();
        res.status(201).json(newCodeBlock);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

app.use(express.static('public'));



const wss = new WebSocket.Server({ server });

const rooms = {}; // Object to hold the rooms

wss.on('connection', function connection(ws) {
    ws.on('message', async function incoming(message) {
        const data = JSON.parse(message);

        switch (data.action) {
            case 'update':
                // Update code block in the database
                await CodeBlock.findOneAndUpdate({ id: data.id }, { code: data.code });
                break;
            // Additional cases as needed...
        }

        // Joining a room
        if (data.action === 'join' && data.id) {
            ws.room = data.id;
            rooms[ws.room] = rooms[ws.room] || [];
            rooms[ws.room].push(ws);
        }

        // Broadcasting a message to a room
        if (data.action === 'update' && ws.room) {
            rooms[ws.room].forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ id: ws.room, code: data.code }));
                }
            });
        }
    });

    ws.on('close', function() {
        if (ws.room && rooms[ws.room]) {
            rooms[ws.room] = rooms[ws.room].filter(client => client !== ws);
        }
    });
});

