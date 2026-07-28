import { redirect } from 'next/navigation'

/** Dispute Letters now lives inside Credit Intelligence. */
export default function DisputeLettersIndexRedirect() {
  redirect('/admin/credit-funding')
}
