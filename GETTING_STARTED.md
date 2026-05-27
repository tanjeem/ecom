# Getting Started Checklist

**For:** Claude Sonnet or any new team member  
**Created:** May 27, 2026  
**Time to Complete:** ~1.5 hours

---

## ✅ Onboarding Checklist

### Phase 1: Understanding the Project (20 minutes)

- [ ] Read `DOCUMENTATION_INDEX.md` (this will guide you)
- [ ] Read `PROJECT_STRUCTURE.md` completely
- [ ] Skim `README.md` for context
- [ ] Understand the three main integrations:
  - [ ] WooCommerce (e-commerce platform)
  - [ ] Pathao (delivery service)
  - [ ] Meta Ads (advertising platform)

**What you should know after Phase 1:**
- The purpose of ThreadOps Commerce OS
- Main modules: Dashboard, Orders, Inventory, Accounting, Ads, Scale Ops
- How data flows between systems
- File organization and where things are

---

### Phase 2: Local Setup (25 minutes)

- [ ] Clone/ensure repository is local
- [ ] Open terminal in project directory
- [ ] Copy environment template: `cp .env.example .env.local`
- [ ] Open `.env.local` and add test credentials:
  - [ ] Get WooCommerce credentials from team
  - [ ] Get Pathao credentials from team
  - [ ] Enter them in `.env.local`
- [ ] Run `npm install`
- [ ] Verify TypeScript: `npm run typecheck` (should show no errors)
- [ ] Start dev server: `npm run dev`
- [ ] Open browser to `http://localhost:3000`
- [ ] Verify dashboard loads (should see orders, KPIs, etc.)
- [ ] Stop dev server (Ctrl+C)

**What you should see:**
- No error messages during install
- Dashboard with sample data loads without errors
- TypeScript compiles without errors

**If something fails:**
- [ ] Check `SETUP_DEPLOYMENT.md` → "Troubleshooting"
- [ ] Verify .env.local has correct credentials
- [ ] Ask team for help

---

### Phase 3: Understanding Code (20 minutes)

- [ ] Open `lib/types/commerce.ts` - read all type definitions
- [ ] Open `lib/integrations/woocommerce.ts` - skim the functions
- [ ] Open `lib/integrations/pathao.ts` - skim the functions
- [ ] Open `app/api/orders/route.ts` - understand the flow
- [ ] Open `index.html` - see the UI structure (basics only)

**What you should know after Phase 3:**
- What data types are used (CommerceOrder, InboxOrderInput, etc.)
- How WooCommerce integration works (basic flow)
- How Pathao integration works (basic flow)
- How an API endpoint is structured

**Key files reference:**
- Types: `lib/types/commerce.ts`
- WooCommerce: `lib/integrations/woocommerce.ts`
- Pathao: `lib/integrations/pathao.ts`
- APIs: `app/api/*/route.ts`

---

### Phase 4: Test Your Setup (20 minutes)

- [ ] Start dev server again: `npm run dev`
- [ ] Test API endpoints with curl:

**Test 1: Config Status**
```bash
curl http://localhost:3000/api/config/status
# Should return: { "woocommerce": true/false, "pathao": true/false }
```

- [ ] Test 2: Get Orders
```bash
curl "http://localhost:3000/api/orders?limit=5"
# Should return array of orders or error
```

- [ ] Test 3: Check Browser Console
  - Open DevTools (F12)
  - Go to Console tab
  - Refresh page
  - Should see no errors (warnings are ok)

- [ ] Test 4: Check Lint
```bash
npm run lint
# Should pass with minimal warnings
```

**What you should verify:**
- Endpoints return proper JSON responses
- No JavaScript errors in browser console
- Code passes linting

---

### Phase 5: Bookmark & Reference (10 minutes)

- [ ] Bookmark `DOCUMENTATION_INDEX.md` in your browser
- [ ] Bookmark `QUICK_REFERENCE.md` in VS Code favorites
- [ ] Create a quick note with:
  - [ ] Project name: ThreadOps Commerce OS
  - [ ] Main tech: Next.js, TypeScript, React
  - [ ] Key integrations: WooCommerce, Pathao, Meta Ads
  - [ ] Dev server: `npm run dev` on port 3000
  - [ ] Type check: `npm run typecheck`
  - [ ] Lint: `npm run lint`

---

### Phase 6: First Task (Varies)

- [ ] Meet with team lead to assign first task
- [ ] Reference docs as needed:
  - Task: Bug fix → Check `QUICK_REFERENCE.md` → "Debugging Tips"
  - Task: Add API endpoint → Check `QUICK_REFERENCE.md` → "Add a New API Endpoint"
  - Task: Connect integration → Check `INTEGRATION_GUIDE.md`
  - Task: Deploy → Check `SETUP_DEPLOYMENT.md`

---

## 📚 Documentation Quick Links

Keep these handy:

| Task | Document | Section |
|------|----------|---------|
| Understand project | `PROJECT_STRUCTURE.md` | All sections |
| Set up locally | `SETUP_DEPLOYMENT.md` | "Local Development Setup" |
| Work with APIs | `API_DOCUMENTATION.md` | "Endpoints" |
| Work with WooCommerce | `INTEGRATION_GUIDE.md` | "WooCommerce Integration" |
| Work with Pathao | `INTEGRATION_GUIDE.md` | "Pathao Integration" |
| Add new endpoint | `QUICK_REFERENCE.md` | "Add a New API Endpoint" |
| Debug issues | `SETUP_DEPLOYMENT.md` | "Troubleshooting" |
| Code examples | `QUICK_REFERENCE.md` | "Code Patterns" |
| Deploy to production | `SETUP_DEPLOYMENT.md` | "Deployment Options" |

---

## 🎯 Success Criteria

You've completed onboarding successfully if you can:

- [ ] Start the dev server and see the dashboard
- [ ] Explain what ThreadOps Commerce OS does
- [ ] Describe how WooCommerce integration works
- [ ] Describe how Pathao integration works
- [ ] Call at least 2 API endpoints with curl and understand the response
- [ ] Find any function in the codebase and understand what it does
- [ ] Run `npm run typecheck` and `npm run lint` without errors
- [ ] Know where to find help (docs or team members)
- [ ] Make a small code change (edit a comment or string)

---

## ❓ Common Questions

**Q: My npm install failed**  
A: Check your Node version (`node --version`). Should be v18+. Run `npm install` again.

**Q: I get "port 3000 already in use"**  
A: Kill other processes on 3000 or use different port: `PORT=3001 npm run dev`

**Q: WooCommerce credential errors**  
A: Contact team for test credentials. Don't make up fake ones - API needs real creds.

**Q: I don't understand a piece of code**  
A: Ask team member during sync, or reference the docs. Take notes.

**Q: Can I modify the folder structure?**  
A: No, stick with current Next.js structure. New ideas can be discussed with team.

**Q: TypeScript keeps showing errors**  
A: Run `npm run typecheck` to see all at once. These are real errors that need fixing.

---

## 📞 Getting Help

### During Setup
1. Check `SETUP_DEPLOYMENT.md` → "Troubleshooting"
2. Ask team for help

### Working on Code
1. Check `QUICK_REFERENCE.md` for similar examples
2. Check related guide (INTEGRATION_GUIDE, API_DOCUMENTATION, etc.)
3. Ask team member

### Understanding Architecture
1. Read relevant section in `PROJECT_STRUCTURE.md`
2. Search for function/type and trace through code
3. Ask senior developer to pair with you

---

## 🚀 Next Steps After Onboarding

Once you complete all phases:

1. **Pick an issue** - Your team lead will assign a small task
2. **Reference documentation** - Use the guides as your reference
3. **Ask questions** - Team is here to help
4. **Make commits** - Follow team's Git workflow
5. **Celebrate** - You've successfully onboarded! 🎉

---

## 📋 Completion Tracker

Print this out or copy to a note:

```
Phase 1 (Understanding):     [ ] Done - Time: _____ min
Phase 2 (Setup):            [ ] Done - Time: _____ min
Phase 3 (Code):             [ ] Done - Time: _____ min
Phase 4 (Testing):          [ ] Done - Time: _____ min
Phase 5 (Reference):        [ ] Done - Time: _____ min
Phase 6 (First Task):       [ ] Done - Time: _____ min

Total Time: _____ minutes
Date Completed: _____________
Signed Off By: _____________
```

---

## 📝 Notes

Use this space to jot down things to remember:

```
Key contacts:
- Tech lead: _____________
- DevOps: _____________
- Product owner: _____________

Important links:
- WooCommerce store: _____________
- Pathao dashboard: _____________
- Slack channel: _____________

Quick facts:
- Project started: _____________
- Key users: _____________
- Main pain points: _____________
```

---

**Congratulations!** 🎉

You're now ready to contribute to ThreadOps Commerce OS. Welcome to the team!

If you have feedback on this checklist, feel free to update it for the next team member.

**Date Completed:** _______________  
**Completed By:** _______________

