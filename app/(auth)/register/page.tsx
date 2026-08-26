import { redirect } from 'next/navigation'

/** Same door as /login, opened on the sign-up half of the card. */
export default function RegisterPage() {
  redirect('/?signup=1')
}
