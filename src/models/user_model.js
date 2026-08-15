import mongoose from "mongoose"
//#schema is like a outer wall before db to check weather the. data is in the format in which we require or not
import bcrypt from "bcryptjs"

const userSchema=mongoose.Schema({
    email:{
        type:String,
        required:[true,"email is required for creating user"],
        trim:true,
        lowercase:true,
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address'],
        unique:[true,"email already exist"]
    },
    name:{
        type:String,
        required:[true,"name is required creating an account"],
    },
    password:{
        type:String,
        required:[true,"password is required"],
        minlength:[6,"password should contain more than 6 letters"],
        select: false
    },
    systemUser:{
        type:Boolean,
        default:false,
        immutable:true,
        select:false
    }
},{timestamps:true})


userSchema.pre("save", async function () {
    if (!this.isModified("password")) {
        return;
    }

    this.password = await bcrypt.hash(this.password, 10);
});

//we use this function because if user change it mail or name so passwrord should not bcrypt again
userSchema.methods.comparePassword = async function(password) {
    return await bcrypt.compare(password, this.password);
};

const userModel=mongoose.model("user",userSchema)

export default userModel;


//just helps use to interacte with db using model and gives format that how data will save and model gives us methoads like find one etc