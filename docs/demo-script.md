Project: Tollkite  
One-liner: A Kite native marketplace where API owners list paid tools, buyers
pay with USDT through x402, and autonomous OpenAI agents buy those tools with
receipts and on chain proof.

## 1. Show The Marketplace Value

- **URL:** /
- **Shot:** Tollkite homepage with the hero, marketplace promise, provider
  earning story, buyer checkout story, agent workflow, and featured provider
  area.
- **Steps:**
  1. **Current page:** Browser start page - confirm the address bar is ready.
  2. **Current page:** Browser start page - open URL directly: [DEMO_URL]/.
  3. **Current page:** / - confirm the Tollkite hero is visible.
  4. **Current page:** / - scroll once through the marketplace, provider
     earning, buyer payment, and agent workflow sections.
  5. **Current page:** / - click "Marketplace" in the top navigation, then lands
     on /marketplace.
  6. **Verify on-screen:** The "Marketplace" heading and paid API table are
     visible.
- **Voiceover:**
  > "This is Tollkite. It is not only for AI agents. It is also for developers,
  > API owners, and regular users who want to run a paid API from the browser.
  > Providers can list an API and earn money per call. Buyers can pay before
  > receiving a result. Developers can integrate the hosted endpoint externally.
  > Agents can do the same thing automatically with a funded budget and proof."

## 2. Get The ClipLore API Key And OpenAPI URL

- **URL:** https://cliplore.ai/dashboard/developers/api-keys
- **Shot:** ClipLore developer dashboard with API keys, Create key form, New API
  key panel, Copy key button, and OpenAPI reference with Copy OpenAPI URL.
- **Steps:**
  1. **Current page:** /marketplace - confirm the Tollkite marketplace table is
     visible.
  2. **Current page:** /marketplace - open URL directly:
     https://cliplore.ai/auth/sign-in?next=/dashboard/developers/api-keys.
  3. **Current page:** /auth/sign-in - confirm the "Sign in" heading is visible.
  4. **Enter values:**
     - Email = [CLIPLORE_EMAIL=owner@example.com]
     - Password = [CLIPLORE_PASSWORD=your_password]
  5. **Current page:** /auth/sign-in - click "Sign in" - wait for the ClipLore
     developer dashboard to load.
  6. **Current page:** /dashboard/developers/api-keys - confirm the "API keys"
     heading is visible.
  7. **Enter values:**
     - Name = Tollkite marketplace
     - Environment = Live
  8. **Current page:** /dashboard/developers/api-keys - click "Create key" -
     wait for the "New API key" panel.
  9. **Current page:** /dashboard/developers/api-keys - click "Copy key" - wait
     for the button text to change to "Copied".
  10. **Current page:** /dashboard/developers/api-keys - open URL directly:
      https://cliplore.ai/developers/openapi.
  11. **Current page:** /developers/openapi - confirm "OpenAPI URL" is visible.
  12. **Current page:** /developers/openapi - click "Copy OpenAPI URL" - wait
      for the button text to change to "Copied".
  13. **Verify on-screen:** ClipLore shows the copied API key confirmation and
      the copied OpenAPI URL confirmation.
- **Voiceover:**
  > "First, I go to ClipLore as the API owner. I sign in, open the developer API
  > key page, name the key Tollkite marketplace, choose Live, and click Create
  > key. ClipLore shows the key only once, so I click Copy key. Then I open the
  > ClipLore OpenAPI reference and click Copy OpenAPI URL. These two values are
  > all I need to turn an existing API subscription into a paid Tollkite
  > marketplace listing."

## 3. Publish The ClipLore API On Tollkite

- **URL:** /provider/products/new
- **Shot:** Tollkite provider listing page with Import OpenAPI, operation
  selector, product details, provider authentication, pricing, async polling,
  visibility, agent ready, and Save API product.
- **Steps:**
  1. **Current page:** https://cliplore.ai/developers/openapi - confirm "OpenAPI
     URL" is visible.
  2. **Current page:** https://cliplore.ai/developers/openapi - open URL
     directly: [DEMO_URL]/provider/products/new.
  3. **Current page:** /provider/products/new - confirm "Import OpenAPI" is
     visible.
  4. **Enter values:**
     - OpenAPI URL = https://cliplore.ai/api/v1/openapi.json
     - Override Server URL = leave empty
  5. **Current page:** /provider/products/new - click "Import spec" - wait for
     "Imported operations" to appear.
  6. **Current page:** /provider/products/new - click the "Imported operation"
     dropdown and select "POST /video/jobs".
  7. **Current page:** /provider/products/new - click "Fill listing" - wait for
     the listing fields to populate.
  8. **Enter values:**
     - Auth type = bearer
     - Header name = Authorization
     - Auth secret or API key = [CLIPLORE_API_KEY=clip_live_your_key]
     - Pricing model = Credit metered
     - Credit value path = estimatedCredits
     - USDT per credit = 0.01
     - Visibility = Published
  9. **Current page:** /provider/products/new - click "Save API product" - wait
     for the product saved confirmation.
  10. **Verify on-screen:** The product management page shows the ClipLore
      product with a "Published" status badge and the connected owner wallet.
- **Voiceover:**
  > "Now I switch back to Tollkite as the provider. I paste the ClipLore OpenAPI
  > URL, import the spec, choose the video job endpoint, and fill the listing.
  > Then I paste the private ClipLore API key into the server side auth field. I
  > set credit metered pricing so Tollkite quotes the job before charging. I
  > publish immediately because this demo should prove that another wallet can
  > buy the API from the public marketplace."

## 4. Switch To A Buyer Wallet And Find The Published API

- **URL:** /marketplace
- **Shot:** Tollkite marketplace with the published ClipLore listing visible to a
  different connected wallet, product cards or table rows, price, provider name,
  and Run with wallet action.
- **Steps:**
  1. **Current page:** /provider/products/[productId] - confirm the "Published"
     status badge is visible.
  2. **Current page:** /provider/products/[productId] - click the wallet account
     button in the header.
  3. **Current page:** Wallet menu - click "Disconnect" - wait for the wallet
     state to clear.
  4. **Current page:** Tollkite header - click "Connect Wallet" - choose a
     different buyer wallet in the wallet modal.
  5. **Current page:** Tollkite header - confirm the buyer wallet address is
     visible.
  6. **Current page:** Tollkite header - click "Marketplace" in the top
     navigation, then lands on /marketplace.
  7. **Current page:** /marketplace - search for "video".
  8. **Current page:** /marketplace - click "View" on the ClipLore video product
     row, then lands on /marketplace/[slug].
  9. **Verify on-screen:** The product detail page shows the ClipLore provider,
     published state, price, endpoint, and "Run with wallet".
- **Voiceover:**
  > "To prove this is a real marketplace and not just the owner testing their
  > own API, I disconnect the provider wallet and connect a different buyer
  > wallet. The buyer did not create this API and does not have the ClipLore API
  > key. They simply go to Marketplace, search video, open the published
  > listing, and see a normal paid API product ready to run."

## 5. Pay For The API And Receive The Result

- **URL:** /orders/[orderId]
- **Shot:** Run and Pay page with Quote, Approve, Sign, Settle, Result steps,
  connected buyer wallet, quote amount, receipt, Kite transaction link, async
  job status, and provider response.
- **Steps:**
  1. **Current page:** /marketplace/[slug] - confirm the ClipLore product detail
     page and "Run with wallet" button are visible.
  2. **Current page:** /marketplace/[slug] - click "Run with wallet", then lands
     on /orders/new?product=[PRODUCT_SLUG].
  3. **Current page:** /orders/new?product=[PRODUCT_SLUG] - confirm "Build a
     payable API call" is visible.
  4. **Current page:** /orders/new?product=[PRODUCT_SLUG] - click "Use sample
     payload".
  5. **Enter values:**
     - Prompt = Create a short launch video explaining Tollkite paid APIs and autonomous agent payments.
     - Format = portrait
     - Duration Seconds = 30
     - Workflow Mode = automatic
     - Finalization Mode = auto_project
  6. **Current page:** /orders/new?product=[PRODUCT_SLUG] - click "Test run" -
     wait for the Run and Pay page to open.
  7. **Current page:** /orders/[orderId] - click "Run" in the payment console.
  8. **Current page:** MetaMask - click "Confirm" for approval if requested.
  9. **Current page:** MetaMask - click "Confirm" for the x402 payment
     signature.
  10. **Current page:** /orders/[orderId] - wait for Quote, Approve, Sign,
      Settle, and Result to complete.
  11. **Verify on-screen:** The page shows the Kite transaction link, receipt
      ID, async job status, and a public project result link.
- **Voiceover:**
  > "This is the buyer experience. Tollkite builds the request form from the
  > provider schema, I use a sample payload, and I pay with my wallet. The buyer
  > pays before ClipLore starts expensive work. Tollkite settles USDT through
  > x402, creates a receipt, starts the provider job, polls the async status,
  > and returns a public project handoff link when the generated video project
  > is ready."

## 6. Open The ClipLore Result And Export The Video

- **URL:** https://cliplore.ai/share/api-projects/[jobId]
- **Shot:** ClipLore public project handoff page with Public API project badge,
  generated project status, Clone to my account or View workflow button, editor
  page, and Export modal.
- **Steps:**
  1. **Current page:** /orders/[orderId] - confirm the public project result
     link is visible.
  2. **Current page:** /orders/[orderId] - click "Open result" or the public
     project URL, then lands on https://cliplore.ai/share/api-projects/[jobId].
  3. **Current page:** /share/api-projects/[jobId] - confirm the "Public API
     project" badge and completed status are visible.
  4. **Current page:** /share/api-projects/[jobId] - click "Clone to my account"
     if this is the buyer account, or click "View workflow" if this is the
     ClipLore owner account.
  5. **Current page:** /edit/[projectId] or workflow task page - confirm the
     generated project opens in ClipLore.
  6. **Current page:** /edit/[projectId] - click "Export".
  7. **Current page:** Export modal - choose "Local render" or "Server render".
  8. **Current page:** Export modal - click "Export" - wait for the render
     completion state or download.
  9. **Verify on-screen:** The ClipLore editor shows the generated video project
     and the export flow starts or completes.
- **Voiceover:**
  > "The paid API result is not just JSON. The buyer gets a ClipLore public
  > handoff URL. If the buyer has a ClipLore account, they can clone the
  > generated project into their own workspace. If the API owner opens it, they
  > can view the workflow directly. From the editor, I click Export, choose
  > local or server render, and produce the final video asset."

## 7. Verify The Receipt And Provider Earnings

- **URL:** /receipts/[receiptId]
- **Shot:** Tollkite receipt page with receipt ID, buyer wallet, provider wallet,
  product, USDT amount, platform fee, provider amount, network, and Kite
  explorer link.
- **Steps:**
  1. **Current page:** https://cliplore.ai/share/api-projects/[jobId] or
     /edit/[projectId] - confirm the generated project result is visible.
  2. **Current page:** ClipLore result page - return to the Tollkite order tab.
  3. **Current page:** /orders/[orderId] - click the visible receipt ID, then
     lands on /receipts/[receiptId].
  4. **Current page:** /receipts/[receiptId] - click the Kite transaction link.
  5. **Current page:** Kite explorer - confirm the transaction page opens.
  6. **Current page:** /receipts/[receiptId] - return to the receipt page.
  7. **Verify on-screen:** The receipt shows buyer wallet, provider wallet, USDT
     amount, fee split, product, and transaction hash.
- **Voiceover:**
  > "After the result, we verify the business side. The receipt shows the buyer
  > wallet, provider wallet, USDT amount, platform fee, provider share, and Kite
  > transaction. This proves the API seller can earn from each paid call while
  > the buyer gets a real result and a verifiable payment record."

## 8. Create And Fund An Autonomous Agent

- **URL:** /agents/new
- **Shot:** Agent creation page with goal, tool strategy, server side tool
  table, connected owner wallet, budget, max actions, and Create run button.
- **Steps:**
  1. **Current page:** /receipts/[receiptId] - confirm the receipt details are
     visible.
  2. **Current page:** /receipts/[receiptId] - click "Agents" in the top
     navigation, then lands on /agents.
  3. **Current page:** /agents - click "Templates".
  4. **Current page:** /agents - click "Use template" on "Video Launch
     Campaign", then lands on /agents/new?template=video-launch-campaign.
  5. **Current page:** /agents/new - click "AI decides".
  6. **Enter values:**
     - Objective = Create a launch campaign for Tollkite showing paid API
       checkout, provider earnings, ClipLore video output, and autonomous agent
       proof.
     - Source context = Tollkite is a Kite native marketplace for APIs, x402
       payments, USDT settlement, provider revenue, browser checkout, developer
       integration, and OpenAI powered agent runs.
     - Budget = 0.90
     - Actions = 4
  7. **Current page:** /agents/new - click "Create run" - wait for the run page
     to load.
  8. **Current page:** /agents/[runId] - click "Fund agent" - confirm the wallet
     funding transaction.
  9. **Verify on-screen:** The funding ledger shows "User funded this autonomous
     agent run" and the funded budget card shows 0.90 USDT.
- **Voiceover:**
  > "Now I show why this is more than a normal API marketplace. I create an
  > autonomous run, let OpenAI choose from the paid tool catalog, set a 0.90
  > USDT budget, and fund the agent vault. The agent cannot spend until the user
  > funds it, and it cannot exceed the budget. This is useful for teams,
  > developers, and users who want real work completed without approving every
  > single API call."

## 9. Run The Agent And Publish Proof

- **URL:** /proofs/[proofId]
- **Shot:** Agent run page with OpenAI planner, selected tools, skipped tools,
  budget ledger, receipts, completed action results, rendered deliverables,
  Attest proof button, and public proof page.
- **Steps:**
  1. **Current page:** /agents/[runId] - confirm the funded budget card and "Run
     actions" button are visible.
  2. **Current page:** /agents/[runId] - click "Run actions".
  3. **Current page:** /agents/[runId] - wait for action cards to move through
     planned, quoted, paid, completed, skipped, or failed.
  4. **Current page:** /agents/[runId] - click "Planner, receipts, and
     deliverable diagnostics".
  5. **Current page:** /agents/[runId] - confirm "Planner: OpenAI gpt-5.2",
     selected tools, skipped tools, receipt IDs, and rendered deliverables are
     visible.
  6. **Current page:** /agents/[runId] - click "Attest proof".
  7. **Current page:** /agents/[runId] - wait for the proof transaction to
     complete.
  8. **Current page:** /agents/[runId] - click the proof link, then lands on
     /proofs/[proofId].
  9. **Verify on-screen:** The proof page shows proof hash, receipts, vault
     funding metadata, spend, refund metadata, and Kite attestation transaction.
- **Voiceover:**
  > "The agent is the automation layer on top of the same marketplace. OpenAI
  > plans the work, Tollkite quotes each paid API, the funded agent pays through
  > x402, receipts are recorded, and the final run is attested on Kite. The
  > proof page lets anyone audit what happened without exposing private API
  > keys, private prompts, or provider secrets."

## Final Wrap-Up

- **URL:** /proofs/[proofId]
- **Shot:** Public proof page with proof hash, receipt IDs, budget metadata,
  spend, refund state, and attestation transaction visible.
- **Steps:**
  1. **Current page:** /proofs/[proofId] - confirm the public proof summary is
     visible.
  2. **Verify final state:** Tollkite showed a provider listing a real ClipLore
     API, a different buyer paying with USDT through x402, a real generated
     project handoff, provider earnings, autonomous OpenAI tool execution,
     receipts, and Kite proof.
- **Voiceover:**
  > "Tollkite proves the full loop. API owners can monetize existing APIs or
  > subscriptions. Buyers and developers can pay per request and receive
  > results. Agents can autonomously buy tools from a funded budget. Every paid
  > action produces receipts, and Kite proof makes the workflow auditable. Try
  > it at [DEMO_URL]."
