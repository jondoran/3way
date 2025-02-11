# 3way

A minimalist web application that enables three-way conversations between a user and two AI assistants (GPT-4 and Claude).

## Demo

https://jondoran.github.io/3way

## Usage

1. Start a conversation by mentioning either assistant:
   - Use `@Chad` to talk to GPT-4
   - Use `@Claude` to talk to Claude

2. Continue the conversation:
   - The last responding assistant will be used if no @mention is included
   - Clear the conversation using the clear button
   - Conversations are automatically saved in your browser

## Features

- Direct messages to specific AI assistants using @mentions (@Chad for GPT-4, @Claude for Claude)
- Persistent conversation history
- Zero-buildstep implementation
- Responsive design
- Client-side storage
- Rate-limited API access

## Tech Stack

- Frontend: Vanilla JavaScript, HTML5, CSS
- Backend: Cloudflare Workers
- Deployment: GitHub Pages
- APIs: OpenAI GPT-4 and Anthropic Claude

## Security

- API keys are securely stored in Cloudflare Workers
- Client-side input sanitization
- Rate limiting implemented
- CORS protection enabled

## Development

This project uses GitHub Codespaces for development and requires:
- Cloudflare Workers account
- OpenAI API key
- Anthropic API key

## Deployment

The application is deployed in two parts:
- Static frontend: GitHub Pages
- API backend: Cloudflare Workers
