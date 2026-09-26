import { Leaf, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from './ThemeProvider'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      onClick={toggleTheme}
      title={isDark ? 'Switch to Agro theme' : 'Switch to Dark theme'}
      aria-label={isDark ? 'Switch to Agro theme' : 'Switch to Dark theme'}
    >
      {isDark ? <Leaf className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}
