---
title: Use Transitions for Non-Urgent Updates
impact: MEDIUM
impactDescription: maintains UI responsiveness
tags: rerender, transitions, startTransition, performance
---

## Use Transitions for Non-Urgent Updates

Mark frequent, non-urgent state updates as transitions to maintain UI responsiveness.

**Incorrect (blocks UI on every scroll):**

```tsx
function ScrollTracker() {
  const [scrollY, setScrollY] = useState(0)
  useEffect(() => {
    const handler = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])
}
```

**Correct (non-blocking updates):**

```tsx
import { startTransition } from 'react'

function ScrollTracker() {
  const [scrollY, setScrollY] = useState(0)
  useEffect(() => {
    const handler = () => {
      startTransition(() => setScrollY(window.scrollY))
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])
}
```

**Correct (Heavy Modal Triggers - Maintaining INP):**

```tsx
import { startTransition } from 'react'

function Dashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleOpenModal = () => {
    // Heavy modals with Wagmi hooks or Li.Fi SDKs block the main thread during mount.
    // startTransition keeps the click interaction responsive (<50ms INP).
    startTransition(() => {
      setIsModalOpen(true)
    })
  }

  return <button onClick={handleOpenModal}>Open Heavy Modal</button>
}
```
