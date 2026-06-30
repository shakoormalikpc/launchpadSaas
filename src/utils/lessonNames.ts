/**
 * Maps lesson IDs to display names for Q&A system
 */
export const lessonNames: Record<string, string> = {
    'earning-money': 'Earning Money',
    'living-on-your-own': 'Living on Your Own',
    'understanding-wants-needs': 'Understanding Wants & Needs',
    'lesson3-wants-needs': 'Understanding Wants & Needs', // Alternative ID
    'saving-investing': 'Saving & Investing',
    'lesson4-saving-investing': 'Saving & Investing',
    'advertising': 'The Influence of Advertising',
    'influence-of-advertising': 'The Influence of Advertising', // Canonical lesson id
    'lesson5-advertising': 'The Influence of Advertising',
    'cost-of-college': 'The Cost of College',
    'lesson6-college': 'The Cost of College',
    'insurance': 'Protecting & Insuring Your Money',
    'protecting-insuring': 'Protecting & Insuring Your Money', // Canonical lesson id
    'lesson7-insurance': 'Protecting & Insuring Your Money',
    'budgeting': 'The Art of Budgeting',
    'art-of-budgeting': 'The Art of Budgeting', // Canonical lesson id
    'lesson8-budgeting': 'The Art of Budgeting',
    'banking': 'Understanding Banking Services',
    'understanding-banking': 'Understanding Banking Services', // Canonical lesson id
    'lesson9-banking': 'Understanding Banking Services',
    'take-home-pay': 'Take-Home Pay – Taxes & Deductions',
    'lesson10-take-home-pay': 'Take-Home Pay – Taxes & Deductions',
    'financial-decisions': 'Making Personal Financial Decisions',
    'lesson11-financial-decisions': 'Making Personal Financial Decisions',
    'credit-score': 'Your Credit Score & You',
    'lesson12-credit-score': 'Your Credit Score & You',
    'consumer-privacy': 'Consumer Privacy',
    'lesson13-consumer-privacy': 'Consumer Privacy',
    'using-credit': 'Using Credit',
    'lesson14-using-credit': 'Using Credit',
};

/**
 * Get display name for a lesson ID
 */
export const getLessonName = (lessonId: string | undefined): string => {
    if (!lessonId) return 'Financial Literacy';
    return lessonNames[lessonId] || lessonId;
};

/**
 * Canonical list of the 14 lessons (id + display name) in course order.
 * These are the lesson ids actually persisted to user_progress / lesson_attempts,
 * used to populate the analytics lesson filter.
 */
export const LESSON_OPTIONS: ReadonlyArray<{ id: string; name: string }> = [
    'earning-money',
    'living-on-your-own',
    'understanding-wants-needs',
    'saving-investing',
    'influence-of-advertising',
    'cost-of-college',
    'protecting-insuring',
    'art-of-budgeting',
    'understanding-banking',
    'take-home-pay',
    'financial-decisions',
    'credit-score',
    'consumer-privacy',
    'using-credit',
].map((id) => ({ id, name: getLessonName(id) }));
