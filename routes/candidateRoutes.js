const express = require('express');
const router = express.Router();
const User = require('../models/user');
const { jwtAuthMiddleware, generateToken } = require('../jwt');
const Candidate = require('../models/candidate');

const checkAdminRole = async (userID) => {
    try {
        const user = await User.findById(userID);
        if (user.role === 'admin') {
            return true;
        }
    } catch (err) {
        return false;
    }
}

// Admin login
router.post("/adminLogin", async (req, res) => {

    try {
        const { aadharnumber, password } = req.body;
        // console.log(" find Admin  step-1")

        const user = await User.findOne({ aadharnumber })

        // console.log("Admin find ........")
        if (!aadharnumber || !(await user.comparePassword(password))) {
            alert(" aadharnumber  and  password  require !");
            return res.status(401).json({ sucess: true, message: " aadharnumber and password require" })
        }
        const payload = {
            id: user.id,
        };

        if (user.role == "admin") {
            const token = await generateToken(payload);
            res.status(200).json({ sucess: true, user, token: token });
        }
        else {
            res.status(400).json({ sucess: false, message: "User not having admin role" })
        }
    } catch (error) {
        console.error(error);
    }
})

// jwtAuthMiddleware

// POST route to add a candidate
router.post('/addCandidate', jwtAuthMiddleware, async (req, res) => {
    try {
 
        const data = req.body    // Assuming the request body contains the candidate data

        // Create a new User document using the Mongoose model
        const newCandidate = new Candidate(data);

        // check if an image was uploaded
        if (req.file) {
            newCandidate.image = req.file.filename;
        }
        // Save the new user to the database
        const response = await newCandidate.save();

        console.log("token genrate go gya-:")
        console.log('data saved');
        res.status(200).json({ sucess: true, response: response });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})

router.put('/:candidateID', async (req, res) => {
    try {
        if (!checkAdminRole(req.user.id))
            return res.status(403).json({ message: 'user does not have admin role' });

        const candidateID = req.params.candidateID; // Extract the id from the URL parameter
        const updatedCandidateData = req.body; // Updated data for the person

        const response = await Candidate.findByIdAndUpdate(candidateID, updatedCandidateData, {
            new: true, // Return the updated document
            runValidators: true, // Run Mongoose validation
        })

        if (!response) {
            return res.status(404).json({ error: 'Candidate not found' });
        }

        console.log('candidate data updated');
        res.status(200).json(response);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})

router.get("/:adminId", jwtAuthMiddleware, async (req, res) => {
    try {
        if (!checkAdminRole(req.user.id)) { return res.status(403).json({ message: 'user does not have admin role' }); }

        const candidateID = req.params.candidateID;
        const response = await User.findOne(candidateID);

        if (!response) {
            return res.status(404).json({ error: 'Admin not found' });
        }

        // console.log("response found -: ", response);
        res.status(200).json(response);

    } catch (error) {
        console.log(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})

router.delete('/:candidateID', jwtAuthMiddleware, async (req, res) => {
    try {
        if (!checkAdminRole(req.user.id))
            return res.status(403).json({ message: 'user does not have admin role' });

        const candidateID = req.params.candidateID; // Extract the id from the URL parameter

        const response = await Candidate.findByIdAndDelete(candidateID);

        if (!response) {
            return res.status(404).json({ error: 'Candidate not found' });
        }

        // console.log('candidate deleted ');
        res.status(200).json(response);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})

// let's start voting
router.post(`/vote/:id`, jwtAuthMiddleware, async (req, res) => {
    // no admin can vote
    // user can only vote once
    const id = req.params.id;
    const userId = req.user.id;

    try {
        // Find the Candidate document with the specified id
        const candidate = await Candidate.findById(id);
        if (!candidate) {
            return res.status(404).json({ message: 'Candidate not found' });
        }
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'user not found' });
        }
        if (user.role == 'admin') {
            return res.status(403).json({ message: 'admin is not allowed' });
        }

        if (user.isVoted) {
            return res.status(200).json({ message: 'You have already voted' });
        }

        // Update the Candidate document to record the vote
        candidate.votes.push({ user: userId })
        candidate.voteCount++;
        await candidate.save();

        // update the user document
        user.isVoted = true
        await user.save();

        return res.status(200).json({ message: 'Vote recorded successfully', isVoted: false });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// vote count 
router.get('/vote/count', async (req, res) => {
    try {
        // Find all candidates and sort them by voteCount in descending order
        const candidate = await Candidate.find().sort({ voteCount: 'desc' });

        // Map the candidates to only return their name and voteCount
        const voteRecord = candidate.map((data) => {
            return {
                image: data.image,
                name: data.name,
                party: data.party,
                count: data.voteCount
            }
        });

        return res.status(200).json(voteRecord);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get List of all candidates with only name and party fields
router.get('/', async (req, res) => {
    try {
        // Find all candidates and select only the name and party fields, excluding _id
        const candidates = await Candidate.find();

        // Return the list of candidates
        res.status(200).json(candidates);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}); 

module.exports = router;