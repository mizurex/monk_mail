// import 'dotenv/config';
// import axios from 'axios';

// async function testWebhook() {
//     const url = 'https://monkmail.vercel.app/webhook';

//     const payload = {
//         ref: "refs/heads/main",
//         repository: {
//             full_name: "monkmail/monk-system"
//         },
//         commits: [
//             {
//                 message: "Test commit for rate limit"
//             }
//         ]
//     };

//     console.log(`Sending mock GitHub webhook to ${url}...`);

//     try {
//         const response = await axios.post(url, payload, {
//             headers: {
//                 'X-GitHub-Event': 'push',
//                 'Content-Type': 'application/json'
//             }
//         });

//         console.log(response.status);
//         console.log(response.data);

//         if ((response.data as any).status === 'ok') {
//             console.log('Success! Message queued for delivery.');
//         }
//     } catch (error: any) {
//         if (error.response) {
//             console.error(`API Error (${error.response.status}):`, error.response.data);
//         } else {
//             console.error('Connection Error:', error.message);
//         }
//     }
// }

// testWebhook();
