import AcceptInvitation from './AcceptInvitation';

export const metadata = { title: 'Join your team — DaktariScribe' };

/** Where invitation emails land. Clerk adds the single-use ticket and the account status to the link. */
export default async function AcceptInvitationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : null);
  return <AcceptInvitation ticket={one(params.__clerk_ticket)} status={one(params.__clerk_status)} />;
}
