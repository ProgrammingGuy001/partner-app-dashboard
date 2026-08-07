import { ArrowLeft } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useRequisite } from '@/context/RequisiteContext';
import SiteRequisiteBucket from '@/pages/SiteRequisiteBucket';
import SiteRequisiteSubmit from '@/pages/SiteRequisiteSubmit';

const SiteRequisiteReview = () => {
    const navigate = useNavigate();
    const { state } = useRequisite();

    if (state.bucket.length === 0) {
        return <Navigate to="/dashboard/site-requisite" replace />;
    }

    return (
        <div className="mx-auto w-full max-w-6xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-8 flex items-center gap-3 border-b pb-6">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate('/dashboard/site-requisite')}
                    aria-label="Back to component selection"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">Review Site Requisite</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Complete each component and submit the request.</p>
                </div>
            </header>

            <SiteRequisiteBucket />
            <SiteRequisiteSubmit />
        </div>
    );
};

export default SiteRequisiteReview;
