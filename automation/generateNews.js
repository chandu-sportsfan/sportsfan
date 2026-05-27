require("dotenv").config()

const fs=require("fs")

const axios=require("axios")

const cron=require("node-cron")

const cloudinary=
require("cloudinary").v2

const Groq=
require("groq-sdk")

const groq=
new Groq({

apiKey:
process.env.GROQ_API_KEY

})

cloudinary.config({

cloud_name:
process.env.CLOUDINARY_CLOUD_NAME,

api_key:
process.env.CLOUDINARY_API_KEY,

api_secret:
process.env.CLOUDINARY_API_SECRET

})

async function rewriteArticle(data){

const headline=

data.appIndex?.seoTitle
||
"Sports Update"

const tag=

data.tags
?.map(
x=>x.itemName
)
.join(",")

||
"Cricket"

const author=

data.authors?.[0]?.name
||
"Sports Desk"

const storyType=

data.storyType
||
"Sports"

const imageCaption=

data.images?.[0]
?.imageCaption
||
""

const prompt=`

You are sports journalist.

Create original sports article.

Headline:
${headline}

Category:
${tag}

Author:
${author}

Story Type:
${storyType}

Context:
${imageCaption}

Need:

1 headline

2 detailed paragraphs

Professional journalism style.

Do not copy wording.

`

const response=

await groq.chat.completions.create({

messages:[

{

role:"user",

content:prompt

}

],

model:
"llama-3.3-70b-versatile",

temperature:0.7,

max_tokens:500

})

return response
.choices[0]
.message
.content

}

function buildSportsFanArticle(
data
){

return{

title:

data.appIndex?.seoTitle
||
"Sports Update",

summary:"",

tag:

data.tags?.[0]
?.itemName
||
"Cricket",

source:
"SportsFan360",

url:"#"

}

}

async function uploadToCloudinary(
article
){

const date=

new Date()
.toISOString()
.split("T")[0]

const formatted=

date.replaceAll(
"-",
"_"
)

const payload={

feed_date:
date,

articles:
[article]

}

fs.writeFileSync(

"temp.json",

JSON.stringify(
payload,
null,
2
)

)

const upload=

await cloudinary
.uploader
.upload(

"./temp.json",

{

resource_type:
"raw",

public_id:

`sf360/articles/articles_${formatted}`,

overwrite:true

}

)

return upload
.secure_url

}

async function getMatchData(){

try{

console.log(

"Running Daily Sports Automation"

)

const response=

await axios.get(

process.env.CRICBUZZ_URL,

{

headers:{

'X-RapidAPI-Key':
process.env.RAPID_API_KEY,

'X-RapidAPI-Host':
process.env.RAPID_API_HOST

}

}

)

let rewritten=""

try{

rewritten=

await rewriteArticle(
response.data
)

}
catch(err){

console.log(

"Groq Error:",

err.message

)

rewritten=

"Sports article unavailable."

}

const article=

buildSportsFanArticle(
response.data
)

article.summary=
rewritten

const cloudinaryURL=

await uploadToCloudinary(
article
)

console.log(

"Uploaded Successfully"

)

console.log(

cloudinaryURL

)

}
catch(err){

console.log(

"Automation Error:",

err.response?.data
||
err.message

)

}

}

cron.schedule(

"0 7 * * *",

async()=>{

await getMatchData()

}

)

console.log(

"Sports Automation Started"

)

console.log(

"Runs Daily At 7 AM"

)