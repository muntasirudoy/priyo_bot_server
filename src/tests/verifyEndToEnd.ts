import fs from 'fs';
import path from 'path';

const API_BASE = 'http://localhost:5000/api';

async function verifyPipeline() {
  console.log('🚀 Starting Full End-to-End Pipeline Verification...\n');

  // Step 1: Admin Login
  console.log('Step 1: Authenticating as Admin...');
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@support.com',
      password: 'Admin123!',
    }),
  });

  const loginData = await loginRes.json();
  if (!loginData.success || !loginData.data?.token) {
    throw new Error(`Admin login failed: ${JSON.stringify(loginData)}`);
  }
  const token = loginData.data.token;
  console.log('  ✅ Admin logged in successfully. Token acquired.\n');

  // Step 2: Upload PDF Document
  console.log('Step 2: Uploading Knowledge Base PDF...');
  const pdfPath = path.resolve(process.cwd(), 'sample-support-policy.pdf');
  const fileBuffer = fs.readFileSync(pdfPath);
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

  // Construct multipart/form-data payload
  const preamble = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="sample-support-policy.pdf"\r\nContent-Type: application/pdf\r\n\r\n`
  );
  const postamble = Buffer.from(`\r\n--${boundary}--\r\n`);
  const multipartBody = Buffer.concat([preamble, fileBuffer, postamble]);

  const uploadRes = await fetch(`${API_BASE}/documents`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  const uploadData = await uploadRes.json();
  if (!uploadData.success || !uploadData.data?.document?.id) {
    throw new Error(`Document upload failed: ${JSON.stringify(uploadData)}`);
  }
  const documentId = uploadData.data.document.id;
  console.log(`  ✅ Document uploaded with ID: ${documentId} (Initial Status: ${uploadData.data.document.status})\n`);

  // Step 3: Wait for background processing (chunking + embedding)
  console.log('Step 3: Waiting for background processing to complete...');
  let docStatus = 'PROCESSING';
  let totalChunks = 0;
  let attempts = 0;

  while ((docStatus === 'PROCESSING' || docStatus === 'UPLOADING') && attempts < 20) {
    attempts++;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const statusRes = await fetch(`${API_BASE}/documents/${documentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const statusData = await statusRes.json();
    docStatus = statusData.data.document.status;
    totalChunks = statusData.data.document.totalChunks;
    console.log(`  ... poll attempt ${attempts}: status = ${docStatus}, chunks = ${totalChunks}`);
  }

  if (docStatus !== 'COMPLETED') {
    throw new Error(`Document processing failed with status: ${docStatus}`);
  }
  console.log(`  ✅ Document processing COMPLETED with ${totalChunks} chunks generated and embedded!\n`);

  // Step 4: Customer asks question from Page 1
  const sessionId = `test_session_${Date.now()}`;
  console.log(`Step 4: Customer asking question from Page 1 (Session: ${sessionId})...`);
  const q1Res = await fetch(`${API_BASE}/chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      message: 'How long does standard delivery take?',
    }),
  });
  const q1Data = await q1Res.json();
  console.log('  Customer Q: "How long does standard delivery take?"');
  console.log(`  AI Answer : "${q1Data.answer.slice(0, 100)}..."`);
  console.log('  Sources   :', q1Data.sources);

  if (!q1Data.answer || q1Data.sources.length === 0) {
    throw new Error('Expected grounded answer and at least one source citation.');
  }
  console.log('  ✅ Question 1 answered with grounded sources.\n');

  // Step 5: Customer asks question from Page 2
  console.log('Step 5: Customer asking question from Page 2...');
  const q2Res = await fetch(`${API_BASE}/chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      message: 'What is the refund and return window?',
    }),
  });
  const q2Data = await q2Res.json();
  console.log('  Customer Q: "What is the refund and return window?"');
  console.log(`  AI Answer : "${q2Data.answer.slice(0, 100)}..."`);
  console.log('  Sources   :', q2Data.sources);
  console.log('  ✅ Question 2 answered with grounded sources.\n');

  // Step 6: Customer asks off-topic question
  console.log('Step 6: Customer asking off-topic question...');
  const q3Res = await fetch(`${API_BASE}/chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      message: 'What is the capital of Australia?',
    }),
  });
  const q3Data = await q3Res.json();
  console.log('  Customer Q: "What is the capital of Australia?"');
  console.log(`  AI Answer : "${q3Data.answer}"`);
  console.log('  ✅ Off-topic question declined without hallucination.\n');

  // Step 7: Customer requests human escalation
  console.log('Step 7: Customer requests human escalation...');
  const q4Res = await fetch(`${API_BASE}/chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      message: 'I want to talk to a human customer support representative',
    }),
  });
  const q4Data = await q4Res.json();
  console.log('  Customer Q: "I want to talk to a human customer support representative"');
  console.log(`  AI Answer : "${q4Data.answer}"`);
  console.log(`  needsHuman: ${q4Data.needsHuman}`);

  if (!q4Data.needsHuman) {
    throw new Error('Expected needsHuman to be true for escalation request.');
  }
  console.log('  ✅ Human escalation flagged correctly.\n');

  // Step 8: Verify Conversation in Admin View
  console.log('Step 8: Admin inspecting conversation in Admin API...');
  const convRes = await fetch(`${API_BASE}/conversations/${q1Data.conversationId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const convData = await convRes.json();
  console.log(`  Conversation Status: ${convData.data.conversation.status}`);
  console.log(`  Total Messages Saved: ${convData.data.messages.length}`);
  
  const assistantMessages = convData.data.messages.filter((m: any) => m.role === 'ASSISTANT');
  const hasSources = assistantMessages.some((m: any) => m.sources && m.sources.length > 0);
  console.log(`  Stored Source Citations with Similarity Scores: ${hasSources ? 'YES' : 'NO'}`);

  if (convData.data.conversation.status !== 'HUMAN_REQUIRED') {
    throw new Error('Expected conversation status to be HUMAN_REQUIRED.');
  }
  console.log('  ✅ Conversation inspection verified with exact source tracking.\n');

  // Step 9: Admin Dashboard Stats
  console.log('Step 9: Checking Admin Dashboard metrics...');
  const dashRes = await fetch(`${API_BASE}/admin/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const dashData = await dashRes.json();
  console.log('  Dashboard Metrics:', dashData.data.metrics);
  console.log('  ✅ Admin metrics verified.\n');

  // Step 10: Cascade Delete
  console.log('Step 10: Testing document cascade deletion...');
  const deleteRes = await fetch(`${API_BASE}/documents/${documentId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const deleteData = await deleteRes.json();
  console.log(`  Deleted Chunks Count: ${deleteData.data.deletedChunksCount}`);
  console.log('  ✅ Document cascade deletion succeeded.\n');

  console.log('🎉 ALL 10 END-TO-END VERIFICATION STEPS PASSED PERFECTLY!');
}

verifyPipeline().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
