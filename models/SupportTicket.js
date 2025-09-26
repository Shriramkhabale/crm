// models/SupportTicket.js
const mongoose = require("mongoose");

const SupportTicketSchema = new mongoose.Schema(
    {
        customerId: { //for manager/support and customer side field. automatically detect and pass.
            type: String
        },
        companyId: {  // pass automatically
            type: String
        },
        assignedTo:{ //field for manager/ support engineer to fill
            type: String
        },
        fieldWorkAssigned: {  //field for manager/ support engineer to fill
            type: Boolean,
            default: false,
        },
        subject: {  //for manager/support and customer side field.
            type: String
        },
        material: {  //for manager/support and customer side field.  added by Rehan 
            type: String
        },
        service: {  //for manager/support and customer side field.  added by Rehan 
            type: String
        },
         delayReason: {  //for manager/support and customer side field.  added by Rehan 
            type: String
        },
        location: {  //for manager/support and customer side field.
            type: String
        },
        description: {  //for manager/support and customer side field.
            type: String
        },
        image: [{  
            type: String
        }],
        isSigned:{type: Boolean},
        
        signImage: {  
            type: String
        },
        status: { //field for manager/support engineer to fill
            type: String,
            default: "open",
        },
        priority: { //field for manager/support engineer to fill
            type: String,
            default: "medium",
        },
        customerName:{  //field for manager/support engineer to fill (optional)
             type: String
        },
        customerMobile:{ //field for manager/support engineer to fill (optional)
             type: String
        },
        reopenReason:{
            type:String
        }
    },
    { timestamps: true }   
);

// manager will ask for comany name(select from dropdown comany name), select department from dropdown , select employee name from dropdown , 
// and from that employe automatically fetch employee id as customer id  and store it.

module.exports = mongoose.model("SupportTicket", SupportTicketSchema);