import { redirect } from 'next/navigation'

/**
 * Signing in happens on the home canvas now — the form is one of its cards.
 *
 * The route stays because it is linked from a dozen places, in and out of this
 * codebase: the editor's guard, a bookmark, an email. Redirecting on the server
 * means none of those have to change and none of them flash a page first.
 */
export default function LoginPage() {
  redirect('/')
}
