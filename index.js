const jwt = require('jsonwebtoken');
const express=require('express');
const app=express();
const cors=require('cors');
const port=process.env.PORT || 5000;
const { ObjectId } = require('mongodb');
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const router = express.Router();

// Middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.sth4y.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    const biodataCollection = client.db("matrimony_db").collection("biodatas");
    const favouriteCollection = client.db("matrimony_db").collection("favourites");

    // JWT Token
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    });

    // Middleware
    const verifyToken = (req, res, next) => {
      const authorization = req.headers.authorization;
      if (!authorization) {
        return res.status(401).send({ message: 'Unauthorized access' });
      }
      const token = authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(403).send({ message: 'Forbidden access' });
        }
        req.decoded = decoded;
        next();
      });
    };
       //use verify admin after verify token
       const verifyAdmin = async (req, res, next) => {
        const email = req.decoded.email;
        const query = { email: email };
        const user = await userCollection.findOne(query);
        const isAdmin = user?.role === 'admin';
        if (!isAdmin) {
          return res.status(403).send({ message: 'Forbidden access' });
        }
        next();

      }



      //user collection
      const userCollection=client.db("matrimony_db").collection("users");
      app.get('/users', verifyToken, verifyAdmin,async(req,res)=>{
        console.log(req.headers);
          const cursor=userCollection.find();
          const result=await cursor.toArray();
          res.send(result);
      })
      
      app.get("/users/:id", async (req, res) => {
        const id = req.params.id;
        const user = await Users.findOne({ _id: id });
        if (user) {
          res.json(user);
        } else {
          res.status(404).json({ message: "User not found" });
        }
        
      })
      
      
      app.get('/users/admin/:email', verifyToken,async(req,res)=>{
        const email=req.params.email;
      
        if(email !== req.decoded.email){
          return res.status(403).send({message:"Forbidden access"});
        }
        const query={email:email};
        const user=await userCollection.findOne(query);
        let admin=false;
      
      if(user)
      {
        admin=user?.role==='admin';
      }
        res.send({admin});
      })
      
      
      app.get("/users", async (req, res) => {
        const search = req.query.search || "";
        const users = await Users.find({
          name: { $regex: search, $options: "i" }, // Case-insensitive search
        });
        res.json(users);
      });
      app.patch("/users/make-admin/:id", verifyToken,verifyAdmin, async (req, res) => {
        const  id  = req.params.id;
       const query={_id: new ObjectId(id)};
       const updadatedDoc={
          $set:{
            role:'admin'
          }
        }
         const result=await userCollection.updateOne(query,updadatedDoc);
         res.json(result);
      });
      app.patch("/users/make-premium/:id",verifyToken,verifyAdmin, async (req, res) => {
        const  id  = req.params.id;
       const query={_id: new ObjectId(id)};
       const updadatedDoc={
          $set:{
            role:'premium'
          }
        }
         const result=await userCollection.updateOne(query,updadatedDoc);
         res.json(result);
      });
      
      
      app.post('/users',async(req,res)=>{
      
          const user=req.body;
          const query={email:user.email};
          const existingUser=await userCollection.findOne(query);
         if(existingUser){
          return res.send({message:"User already exists"});
         } 
      
          const result=await userCollection.insertOne(user);
          res.json(result);
      });
      
      

    // Get all biodatas with filtering
    app.get('/biodatas', async (req, res) => {
      const { ageRange, type, division } = req.query;
      const query = {};
      if (type) query.type = type;
      if (division) query.division = division;
      if (ageRange) {
        const [minAge, maxAge] = ageRange.split('-').map(Number);
        query.age = { $gte: minAge, $lte: maxAge };
      }
      try {
        const biodatas = await biodataCollection.find(query).toArray();
        res.json(biodatas);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch biodatas' });
      }
    });

    app.get("/biodatas/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const profile = await biodataCollection.findOne({ _id: new ObjectId(id) }); // Convert to ObjectId
        if (profile) {
          res.send(profile);
        } else {
          res.status(404).send({ error: "Profile not found" });
        }
      } catch (error) {
        res.status(500).send({ error: "Failed to fetch profile" });
      }
    });
    // Create a new biodata
    app.post('/biodatas', async (req, res) => {
      try {
        const result = await biodataCollection.insertOne(req.body);
        res.status(201).send({ success: true, message: 'Biodata created successfully!', data: result });
      } catch (error) {
        res.status(500).send({ success: false, message: 'An error occurred while creating the biodata.' });
      }
    });

    // Update an existing biodata
    app.put('/biodatas/:id', async (req, res) => {
      const { id } = req.params;
      try {
        const result = await biodataCollection.updateOne(
          { _id: new ObjectId(id) }, 
          { $set: req.body }
        );
        if (result.modifiedCount === 1) {
          res.send({ success: true, message: 'Biodata updated successfully!' });
        } else {
          res.status(404).send({ success: false, message: 'Biodata not found.' });
        }
      } catch (error) {
        res.status(500).send({ success: false, message: 'An error occurred while updating the biodata.' });
      }
    });

    app.get("/biodatas", async (req, res) => {
      const type = req.query.type;
      try {
        const similarProfiles = await biodataCollection.find({ type }).limit(3).toArray();
        res.send(similarProfiles);
      } catch (error) {
        res.status(500).send({ error: "Failed to fetch similar profiles" });
      }
    });
    

     // Add to Favorites
     app.post('/favourites', async (req, res) => {
      const favourite = req.body;
      const result = await favouriteCollection.insertOne(favourite);
      res.json(result);
    });

    // Get Favorites by Email
    app.get('/favourites', async (req, res) => {
      const email = req.query.email;
      const query = { email };
      const result = await favouriteCollection.find(query).toArray();
      res.send(result);
    });

    // Delete from Favorites
    app.delete('/favourites/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      try {
        const result = await favouriteCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 1) {
          res.send({ success: true, message: 'Biodata deleted successfully!' });
        } else {
          res.status(404).send({ success: false, message: 'Biodata not found!' });
        }
      } catch (error) {
        res.status(500).send({ success: false, message: 'An error occurred while deleting the biodata.' });
      }
    });



    app.post("create-paymet-intent", async (req, res) => {
      const { paymentMethodId, biodataId, email, amount } = req.body;

      try {
       
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount, 
          currency: "usd",
          payment_method: paymentMethodId,
          confirmation_method: "manual",
          confirm: true,
        });

        if (paymentIntent.status === "succeeded") {
          // Insert payment details into the database
          await db.collection("contactRequests").insertOne({
            biodataId: new ObjectId(biodataId),
            email,
            amount,
            status: "pending",
            createdAt: new Date(),
          });

          return res.send({ success: true, message: "Payment successful!" });
        } else {
          return res.status(400).send({ success: false, message: "Payment failed" });
        }
      } catch (error) {
        console.error("Error processing payment:", error);
        return res.status(500).send({ success: false, message: "Server error" });
      }
    });
    module.exports = router;

    // Connect to MongoDB
    await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB!");
  } finally {
    // Keep connection open
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
