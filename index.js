const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
require("dotenv").config();
const cors = require("cors");
const port = 3000;

app.use(cors());
app.use(express.json());

const uri =
  process.env.MONGODB_URI || `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.ddxvdvm.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect();

    const db = client.db("EI-hub");
    const modelCollection = db.collection("models");
    const importCollection = db.collection("imports");
    const exportCollection = db.collection("exports");
    const usersCollection = db.collection("users");

    // Find all models API
    app.get("/models", async (req, res) => {
      const result = await modelCollection.find().toArray();
      res.send(result);
    });

    // Find model by id API
    app.get("/models/:id", async (req, res) => {
      const { id } = req.params;
      console.log("Getting model with id:", id);
      const queryId = new ObjectId(id);
      const result = await modelCollection.findOne({ _id: queryId });
      res.send(result);
    });

    // Insert new model API
    app.post("/models", async (req, res) => {
      const newModel = req.body;
      console.log("Adding new model:", newModel);
      const result = await modelCollection.insertOne(newModel);
      res.send(result);
    });

    // Update model API
    app.put("/models/:id", async (req, res) => {
      const { id } = req.params;
      const updateData = req.body;
      console.log("Updating model with id:", id, updateData);
      
      try {
        const queryId = new ObjectId(id);
        const result = await modelCollection.updateOne(
          { _id: queryId },
          { $set: updateData }
        );
        
        if (result.matchedCount === 0) {
          return res.status(404).send({ error: "Product not found" });
        }
        
        res.send(result);
      } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).send({ error: "Failed to update product" });
      }
    });

    // Delete model API
    app.delete("/models/:id", async (req, res) => {
      const { id } = req.params;
      console.log("Deleting model with id:", id);
      
      try {
        const queryId = new ObjectId(id);
        const result = await modelCollection.deleteOne({ _id: queryId });
        
        if (result.deletedCount === 0) {
          return res.status(404).send({ error: "Product not found" });
        }
        
        res.send(result);
      } catch (error) {
        console.error("Error deleting product:", error);
        res.status(500).send({ error: "Failed to delete product" });
      }
    });

    // Create Import API
    app.post("/imports", async (req, res) => {
      const { userId, productId, quantity } = req.body;
      console.log("Creating import record:", req.body);

      // Find the product by productId to update the available quantity
      const product = await modelCollection.findOne({ _id: new ObjectId(productId) });
      if (!product) {
        return res.status(404).send({ error: "Product not found" });
      }

      // Update the available quantity for the product
      const updatedQuantity = product.availableQuantity - quantity;

      if (updatedQuantity < 0) {
        return res.status(400).send({ error: "Not enough stock available" });
      }

      // Insert the import record
      const importData = {
        userId,
        productId,
        productName: product.name,
        quantity,
        price: product.price,
        createdAt: new Date(),
      };

      const importResult = await importCollection.insertOne(importData);

      // Update the product available quantity in the models collection
      await modelCollection.updateOne(
        { _id: new ObjectId(productId) },
        { $set: { availableQuantity: updatedQuantity } }
      );

      res.send(importResult);
    });

    // Get imports for a user
    app.get("/imports", async (req, res) => {
      const { userId } = req.query;
      console.log("Getting imports for user:", userId);
      const imports = await importCollection
        .find({ userId })
        .toArray();
      res.send(imports);
    });

    // Create Export API
    app.post("/exports", async (req, res) => {
      const { userId, productId, quantity } = req.body;
      console.log("Creating export record:", req.body);

      // Find the product by productId to update the available quantity
      const product = await modelCollection.findOne({ _id: new ObjectId(productId) });
      if (!product) {
        return res.status(404).send({ error: "Product not found" });
      }

      // Update the available quantity for the product
      const updatedQuantity = product.availableQuantity + quantity;

      // Insert the export record
      const exportData = {
        userId,
        productId,
        productName: product.name,
        quantity,
        price: product.price,
        createdAt: new Date(),
      };

      const exportResult = await exportCollection.insertOne(exportData);

      // Update the product available quantity in the models collection
      await modelCollection.updateOne(
        { _id: new ObjectId(productId) },
        { $set: { availableQuantity: updatedQuantity } }
      );

      res.send(exportResult);
    });

    // Get exports for a user
    app.get("/exports", async (req, res) => {
      const { userId } = req.query;
      console.log("Getting exports for user:", userId);
      const exports = await exportCollection
        .find({ userId })
        .toArray();
      res.send(exports);
    });

    // Save or update user role
    app.post("/users", async (req, res) => {
      const { userId, role, email, name } = req.body;
      console.log("Saving user role:", { userId, role, email, name });
      
      try {
        const userData = {
          userId,
          role,
          email,
          name,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        const existingUser = await usersCollection.findOne({ userId });
        
        if (existingUser) {
          // Update existing user
          await usersCollection.updateOne(
            { userId },
            { $set: { role, updatedAt: new Date() } }
          );
          res.send({ message: "User role updated", role });
        } else {
          // Create new user
          const result = await usersCollection.insertOne(userData);
          res.send({ message: "User created", role, _id: result.insertedId });
        }
      } catch (error) {
        console.error("Error saving user:", error);
        res.status(500).send({ error: "Failed to save user" });
      }
    });

    // Get user role
    app.get("/users/:userId", async (req, res) => {
      const { userId } = req.params;
      console.log("Getting user role for:", userId);
      
      try {
        const user = await usersCollection.findOne({ userId });
        if (user) {
          res.send({ role: user.role });
        } else {
          res.status(404).send({ error: "User not found" });
        }
      } catch (error) {
        console.error("Error getting user:", error);
        res.status(500).send({ error: "Failed to get user" });
      }
    });

    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensure client will close when you finish/error
    // await client.close();
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
