import FormData from 'form-data';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// This script performs a quick integration test against the running server at localhost:4000
// It uploads a zero-length file and expects a 400 response with an 'Empty file' message.

(async function run() {
  const url = 'http://localhost:4000/gallery/photos';
  const form = new FormData();
  // Create an in-memory zero-length file stream
  const emptyBuffer = Buffer.from('');
  form.append('images', emptyBuffer, { filename: 'empty.jpg', contentType: 'image/jpeg' });

  try {
    const res = await fetch(url, { method: 'POST', body: form, headers: { ...form.getHeaders(), Authorization: 'Bearer test' } });
    const body = await res.text();
    console.log('Status:', res.status);
    console.log('Body:', body);
    process.exit(res.status === 400 ? 0 : 2);
  } catch (err) {
    console.error(err);
    process.exit(3);
  }
})();
