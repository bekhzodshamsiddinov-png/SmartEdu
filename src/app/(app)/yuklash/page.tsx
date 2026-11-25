import { redirect } from 'next/navigation';
import { requireSection } from '@/lib/auth';
import { getBranchScope } from '@/lib/branch';
import { courseOptions, groupOptions, staffOptions } from '@/lib/options';
import { today } from '@/lib/dates';
import { ImportView } from './view';

export const metadata = { title: "Excel'dan yuklash" };

export default async function ImportPage() {
  const user = await requireSection('students');
  if (!['rahbar', 'admin'].includes(user.role)) redirect('/?ruxsat=yoq');
  const scope = await getBranchScope();
  const [courses, groups, teachers, sellers] = await Promise.all([
    courseOptions(),
    groupOptions(scope.id ?? null),
    staffOptions(['oqituvchi', 'rahbar', 'admin']),
    staffOptions(['sotuv']),
  ]);
  return <ImportView courses={courses} groups={groups} teachers={teachers} sellers={sellers} today={today()} />;
}
