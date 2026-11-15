/* সার্ভিস ওয়ার্কার: শুধু “ইনস্টল করা যায়” শর্ত পূরণের জন্য। কোনো ক্যাশ রাখে না, তাই সাইট সবসময় নতুন থাকে। */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function () { /* সরাসরি নেটওয়ার্ক থেকে আসে */ });
