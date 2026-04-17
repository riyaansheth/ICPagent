Here’s a clean, professional README.md tailored exactly to your project and codebase:

⸻

ICP Matching & Lead Qualification Agent

Overview

The ICP Matching & Lead Qualification Agent is an AI-powered system designed to evaluate LinkedIn prospects against a defined Ideal Customer Profile (ICP).

It helps founders and growth teams focus only on high-quality leads by scoring and filtering prospects before outreach, improving conversion rates and reducing wasted effort.

⸻

Problem Statement

In outbound systems, a major inefficiency comes from targeting a broad audience without proper qualification.

This leads to:

* Low-quality replies
* Wasted time on unqualified leads
* Poor conversion from outreach to meetings

This agent solves that by introducing a qualification layer before engagement.

⸻

Solution

The system analyzes LinkedIn profiles and compares them against a structured ICP.

It outputs:

* A score out of 100
* A tier classification (Hot, Warm, Cold)
* A profile summary
* Dimension-wise scoring
* Reasoning
* Recommended next action

This enables teams to prioritize high-fit prospects and ignore low-value leads.

⸻

Features

* ICP-based scoring using multiple dimensions:
    * Title Fit
    * Company Fit
    * Pain Signals
    * Timing Signals
* Structured JSON output for easy integration
* Decision layer:
    * Hot → Direct outreach
    * Warm → Nurture
    * Cold → Ignore
* LinkedIn profile extraction using Proxycurl
* Model fallback system (auto-switch on rate limits)
* Local storage for:
    * API keys
    * ICP configuration
* Session history tracking and CSV export

⸻

Tech Stack

* Frontend: HTML, CSS, JavaScript
* AI Model: Groq LLaMA (llama-3.3-70b, fallback to 8b)
* Data Extraction: Proxycurl API
* Storage: Browser LocalStorage

⸻

Project Structure

* ￼
    Handles prompt creation, API calls, scoring logic, and response validation
* ￼
    Manages UI logic, state, event handling, and rendering
* ￼
    Frontend structure and layout
* ￼
    Styling and UI design
* ￼
    Utility test for DOM handling

⸻

How It Works

1. User inputs:
    * LinkedIn profile URL
    * ICP configuration
2. Profile data is extracted using Proxycurl
3. The agent builds a structured prompt using ICP + profile data
4. Groq LLaMA model evaluates the prospect
5. The system returns:
    * Score (0–100)
    * Tier (Hot / Warm / Cold)
    * Detailed reasoning
    * Next action
6. Results are displayed and stored in session history

⸻

Setup Instructions

1. Clone the repository
2. Open the project in a browser (no backend required)
3. Add API keys:
    * Groq API key
    * Proxycurl API key
4. Define your ICP:
    * Target roles
    * Industry
    * Company size
    * Pain points
5. Enter a LinkedIn profile URL and click “Score Prospect”

⸻

Output Example

Score: 82
Tier: Hot
Title Fit: 22/25  
Company Fit: 20/25  
Pain Signal: 20/25  
Timing Signal: 20/25  
Reasoning:
Strong alignment with target role and company size. Clear indicators of outbound scaling and relevant challenges.
Next Action:
Send a direct, personalized outreach with a meeting CTA.

⸻

Use Cases

* B2B outbound prospecting
* Lead qualification before sales calls
* ICP validation and refinement
* Sales pipeline optimization

⸻

Future Improvements

* CRM integration (HubSpot, Salesforce)
* Batch lead scoring
* Enrichment via additional data sources
* Real-time LinkedIn activity signal detection
* Automated outreach integration

⸻

Key Insight

Improving who you target has a compounding effect on the entire funnel.

Better targeting leads to:

* Higher quality conversations
* Better conversion rates
* More predictable pipeline

