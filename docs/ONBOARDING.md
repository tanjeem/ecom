# Developer Onboarding Checklist

## ✅ Pre-Setup (5 minutes)

- [ ] Understand the project: ThreadOps is an e-commerce operations dashboard
- [ ] Check tech stack: Next.js 16, React 18, TypeScript, Lucide Icons
- [ ] Verify Node.js version: `node -v` (need 20+)
- [ ] Verify npm: `npm -v` (need 9+)

## ✅ Local Setup (15 minutes)

- [ ] Clone repository to local machine
- [ ] Navigate to project folder: `cd /Users/tanzeem/Desktop/SP/ecom`
- [ ] Install dependencies: `npm install` (5-10 minutes)
- [ ] Copy environment file: `cp .env.example .env.local`
- [ ] Get `.env.local` values from team lead or use example values for testing

## ✅ First Run (10 minutes)

- [ ] Start dev server: `npm run dev`
- [ ] Verify no errors in terminal
- [ ] Open browser: `http://localhost:3000`
- [ ] Dashboard loads without errors ✓
- [ ] Click through all sidebar sections (Dashboard, Orders, Inventory, Accounting, Ads, Scale)
- [ ] Each section loads without JavaScript errors
- [ ] Search bar works
- [ ] Topbar buttons are clickable

## ✅ Understand the Project (30 minutes)

- [ ] Read `PROJECT_STRUCTURE.md` for overall architecture
- [ ] Review `DEVELOPER_HANDBOOK.md` for detailed guides
- [ ] Understand folder structure:
  - `components/` - React components
  - `app/api/` - Server routes
  - `lib/` - Utilities and types
- [ ] Look at one component file to understand the pattern
- [ ] Identify where styles are: `styles.css` (global) and `app/globals.css`

## ✅ Environment Configuration (10 minutes)

- [ ] Open `.env.local` in your editor
- [ ] Review variables needed:
  - WooCommerce: URL, Consumer Key, Secret
  - Pathao: Base URL, Client ID, Secret, Store ID, etc.
  - Meta Ads: API Token (for future)
- [ ] Ask team lead for credentials or use development values
- [ ] Save `.env.local` (don't commit it!)

## ✅ First Component Exploration (15 minutes)

- [ ] Open `components/Views/DashboardView.tsx`
- [ ] Understand the structure:
  - Imports at top
  - Component definition with props interface
  - JSX return statement
  - Child components used
- [ ] Find where `MetricCard` is used
- [ ] Open `components/Common/MetricCard.tsx` to see how it works
- [ ] Understand component composition

## ✅ First Code Change (10 minutes)

- [ ] Open `components/Common/MetricCard.tsx`
- [ ] Change a label or style to test if hot reload works
- [ ] Save file
- [ ] Verify change appears in browser automatically
- [ ] Revert change back to original
- [ ] Confirm hot reload works (this is key!)

## ✅ Try Forms (10 minutes)

- [ ] Navigate to Orders section
- [ ] See the Inbox Order Tool form
- [ ] Try the "Parse Paste" button with sample data
- [ ] Fill out form fields
- [ ] Click "Verify & Create Woo Order" (won't work without real WooCommerce, but shows button works)
- [ ] See status messages

## ✅ Understand API Routes (15 minutes)

- [ ] Open `app/api/config/status/route.ts`
- [ ] See how GET endpoint is structured
- [ ] Open `app/api/orders/inbox/route.ts`
- [ ] See how POST endpoint handles data
- [ ] Understand error handling pattern:
  ```typescript
  try { ... } catch (error) { ... }
  ```
- [ ] Note that API responses are JSON

## ✅ Git Setup (10 minutes)

- [ ] Verify git is installed: `git --version`
- [ ] Configure git (if needed):
  ```bash
  git config --global user.name "Your Name"
  git config --global user.email "your@email.com"
  ```
- [ ] Understand branch structure:
  - `main` - Production code
  - `develop` - Development branch (create from here)
  - `feature/your-feature` - Your feature branch
- [ ] Create your first feature branch:
  ```bash
  git checkout -b feature/test-branch
  ```

## ✅ Available Commands (5 minutes)

- [ ] Development: `npm run dev` (already running)
- [ ] Type checking: `npm run typecheck` (catches TypeScript errors)
- [ ] Linting: `npm run lint` (checks code quality)
- [ ] Build: `npm run build` (production build)
- [ ] Production: `npm start` (run production build)

## ✅ Identify Your First Task (20 minutes)

- [ ] Ask team lead: "What should I work on first?"
- [ ] Possible first tasks:
  - [ ] Add a new metric to Dashboard
  - [ ] Style improvement to a component
  - [ ] Add a new filter option to Orders table
  - [ ] Create a simple UI component
  - [ ] Add loading state to a button
  - [ ] Fix a styling issue
  - [ ] Add validation to a form
- [ ] Create feature branch: `git checkout -b feature/your-task`
- [ ] Start working!

## ✅ Code Quality Checks (5 minutes)

- [ ] Run type checker: `npm run typecheck`
- [ ] Run linter: `npm run lint`
- [ ] Fix any errors or warnings
- [ ] Verify no console errors in browser (F12)

## ✅ Create Your First PR (15 minutes)

- [ ] Commit your work: `git add . && git commit -m "Add feature description"`
- [ ] Push to remote: `git push origin feature/your-task`
- [ ] Go to GitHub
- [ ] Create Pull Request with description
- [ ] Request review from team lead
- [ ] Address review comments
- [ ] Merge when approved

## ✅ Tips for Success

### Code Editing
- [ ] Use VS Code (recommended)
- [ ] Install Prettier extension for auto-formatting
- [ ] Install ESLint extension for error detection
- [ ] Enable auto-save in VS Code settings

### Debugging
- [ ] Use browser DevTools (F12) to inspect HTML
- [ ] Check Network tab to see API calls
- [ ] Use Console tab to see errors
- [ ] Add `console.log()` in code to debug
- [ ] Use debugger: `debugger;` in code, then open DevTools

### Component Development
- [ ] Always add TypeScript interfaces for props
- [ ] Use descriptive component and prop names
- [ ] Keep components focused (one responsibility)
- [ ] Extract reusable logic to separate functions
- [ ] Comment complex logic

### Performance
- [ ] Keep components under 300 lines
- [ ] Don't inline large objects in JSX
- [ ] Use useMemo for expensive calculations
- [ ] Avoid prop drilling (pass only needed props)

### Testing
- [ ] Test in browser first
- [ ] Check all screen sizes (desktop, tablet, mobile)
- [ ] Test with keyboard navigation
- [ ] Verify error messages appear correctly

## ✅ Common Issues & Solutions

### Port Already in Use
```bash
# If port 3000 is busy, find process:
lsof -i :3000
# Kill it:
kill -9 <PID>
```

### Module Not Found Error
```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install
```

### TypeScript Errors
```bash
# Run type checker to see all errors
npm run typecheck
```

### Hot Reload Not Working
- [ ] Check that file is saved
- [ ] Check terminal for errors
- [ ] Try refreshing browser manually (Cmd+R)
- [ ] Restart dev server (Ctrl+C, then `npm run dev`)

### Components Not Appearing
- [ ] Check component is exported correctly
- [ ] Check it's imported in parent component
- [ ] Verify className is in the CSS file
- [ ] Check browser console for JavaScript errors

## ✅ Resources

- **Project Docs:** `COMPLETE_SETUP.md`, `DEVELOPER_HANDBOOK.md`
- **Next.js Docs:** https://nextjs.org/docs
- **React Docs:** https://react.dev
- **TypeScript:** https://www.typescriptlang.org/docs
- **Lucide Icons:** https://lucide.dev

## ✅ Questions?

1. **Check documentation first** - Answer probably in DEVELOPER_HANDBOOK.md
2. **Search the codebase** - Use Ctrl+Shift+F in VS Code
3. **Look for similar code** - Check how other components do it
4. **Ask team lead** - Don't get stuck alone!

---

## 🎉 You're Ready!

You've completed onboarding! You now understand:
- ✅ How the project is structured
- ✅ How to run it locally
- ✅ How components work
- ✅ How to edit code and see changes
- ✅ How to make commits and PRs
- ✅ Where to find help

**Next step:** Start your first feature task!

**Questions?** Ask your team lead.

**Happy coding! 🚀**
