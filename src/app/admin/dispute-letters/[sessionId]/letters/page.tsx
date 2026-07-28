import DisputeLettersResultStep from '@/components/dispute-letters/DisputeLettersResultStep'
import { redirectAppLinkedDisputeSession } from '@/lib/dispute-letters/redirect-app-linked'

type Params = { params: Promise<{ sessionId: string }> }

export default async function DisputeLettersResultPage({ params }: Params) {
  const { sessionId } = await params
  await redirectAppLinkedDisputeSession(sessionId, 'letters')
  return (
    <div className="p-6">
      <DisputeLettersResultStep sessionId={sessionId} />
    </div>
  )
}
