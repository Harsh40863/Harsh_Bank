// start server this file
// #require is just like import it just that it is old but in the companyies whose code is written long back use require thats why we are using require in this

import app from "./src/app.js";
import connectToDB from "./src/config/db.js";

connectToDB()
app.listen(3000,()=>{
    console.log("server is running on port 3000")
    
})

