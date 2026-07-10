import express from 'express'
const app = express()
const port = 3000;
// app.get('/',(req,res)=>{
//     res.json({message: "Hi Mangkorn connect"})
// })
// app.post('/api/Faculty', async(req,res)=>{
    
// })
// app.get('/hi',(req,res)=>{
//     res.send({message:`Hi Gam`})
    
// })

// app.get('api/subjects',async(req,res) =>{
//     res.json({message:"Hell wolrd"})
// })
app.listen(port,()=>console.log(`Server running on port ${port}`))