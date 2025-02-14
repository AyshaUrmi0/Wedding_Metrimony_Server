const jwt = require('jsonwebtoken');
const express=require('express');
const app=express();
const cors=require('cors');
const port=process.env.PORT || 5000;
const {ObjectId} = require('mongodb');
require('dotenv').config();

// Middleware
app.use(cors());
app.use(express.json());



const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.sth4y.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    //await client.connect();


    //jwt token
    app.post('/jwt',async(req,res)=>{
      const user=req.body;
      const token=jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{expiresIn:'1h'});
      res.send({token});
    })

    //middle ware
    const verifyToken = (req, res, next) => {
      const authorization = req.headers.authorization;
      console.log("inside verifyToken",authorization);
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



    const profileCollection=client.db("matrimony_db").collection("profiles");

app.get('/biodatas', async (req, res) => {
  const { ageRange, type, division } = req.query;
  const query = {};

  // Add filtering conditions based on query parameters
  if (type) query.type = type; // Male or Female
  if (division) query.division = division;
  if (ageRange) {
    const [minAge, maxAge] = ageRange.split('-').map(Number);
    query.age = { $gte: minAge, $lte: maxAge };
  }

  try {
    const biodatas = await profileCollection.find(query).limit(20).toArray();
    res.json(biodatas);
  } catch (error) {
    console.error('Error fetching biodatas:', error);
    res.status(500).json({ error: 'Failed to fetch biodatas' });
  }
});


app.get('/biodatas/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const profile = await profileCollection.findOne({ id: parseInt(id) });
    if (profile) {
      res.send(profile);
    } else {
      res.status(404).send({ error: 'Profile not found' });
    }
  } catch (error) {
    res.status(500).send({ error: 'Failed to fetch profile' });
  }
});



    
    
    app.get("/profiles", async (req, res) => {
      const { sort } = req.query;
    
      try {
        
        const sortOrder = sort === "asc" ? 1 : sort === "desc" ? -1 : 1; // Default to ascending if no valid sort is provided
    
       
        const profiles = await profileCollection
          .find({ isPremium: true })
          .sort({ age: sortOrder }) 
          .limit(6)
          .toArray();
    
        res.json(profiles);
      } catch (error) {
        console.error("Error fetching profiles:", error);
        res.status(500).json({ error: "Failed to fetch profiles." });
      }
    });
    


// creat favourite collection

const favouriteCollection=client.db("matrimony_db").collection("favourites");

app.post('/favourites',async(req,res)=>{
    const favourite=req.body;
    const result=await favouriteCollection.insertOne(favourite);
    res.json(result);
});

app.get('/favourites',async(req,res)=>{
  const email=req.query.email;
  const query={email:email};
    const cursor=favouriteCollection.find(query);
    const result=await cursor.toArray();
    res.send(result);
});
app.delete('/favourites/:id',verifyToken,verifyAdmin, async (req, res) => {
  const id = req.params.id;

  try {
      const query = { _id: new ObjectId(id) }; 
      const result = await favouriteCollection.deleteOne(query);

      if (result.deletedCount === 1) {
          res.send({ success: true, message: 'Biodata deleted successfully!' });
      } else {
          res.status(404).send({ success: false, message: 'Biodata not found!' });
      }
  } catch (error) {
      console.error('Error deleting biodata:', error);
      res.status(500).send({ success: false, message: 'An error occurred while deleting the biodata.' });
  }
});



//get all biodatas from favourite collection
app.get('/favourites/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const profile = await profileCollection.findOne({ id: parseInt(id) });
    if (profile) {
      res.send(profile);
    } else {
      res.status(404).send({ error: 'Profile not found' });
    }
  } catch (error) {
    res.status(500).send({ error: 'Failed to fetch profile' });
  }
});


// biodata collection for edit biodata route
const biodataCollection = client.db("matrimony_db").collection("biodatas");

app.get('/biodata', async (req, res) => {
  try {
      const cursor = biodataCollection.find();
      const result = await cursor.toArray();
      res.send(result);
  } catch (error) {
      console.error('Error fetching biodatas:', error);
      res.status(500).send({ success: false, message: 'An error occurred while fetching the biodatas.' });
  }
});


app.post('/biodata', async (req, res) => {
  try {
      // Get the last biodata id to generate the new one
      const lastBiodata = await biodataCollection.findOne({}, { sort: { id: -1 } });
      const newId = lastBiodata ? lastBiodata.id + 1 : 1; 

      const newBiodata = {
          id: newId, 
          ...req.body, 
      };

      const result = await biodataCollection.insertOne(newBiodata);
      res.status(201).send({ success: true, message: 'Biodata created successfully!', data: result.ops[0] });
  } catch (error) {
      console.error('Error creating biodata:', error);
      res.status(500).send({ success: false, message: 'An error occurred while creating the biodata.' });
  }
});

// To edit an existing biodata
app.put('/biodata/:id', async (req, res) => {
  const { id } = req.params;
  try {
      const result = await biodataCollection.updateOne(
          { id: parseInt(id) }, 
          { $set: req.body }
      );

      if (result.modifiedCount === 1) {
          res.send({ success: true, message: 'Biodata updated successfully!' });
      } else {
          res.status(404).send({ success: false, message: 'Biodata not found.' });
      }
  } catch (error) {
      console.error('Error updating biodata:', error);
      res.status(500).send({ success: false, message: 'An error occurred while updating the biodata.' });
  }
});

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


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);




app.listen(port,()=>{
    console.log(`Example app listening on port ${port}`)
})