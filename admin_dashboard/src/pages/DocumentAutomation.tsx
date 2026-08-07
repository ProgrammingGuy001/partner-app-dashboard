import { useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Download,
  FileText,
  FileSpreadsheet,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  jobAPI,
  type MonthlyDocumentRequest,
  type MonthlyProjectRow,
  type NcrDocumentRow,
  type ProjectDocumentRequest,
} from "@/api/services";
import { useJobs } from "@/hooks/useJobs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/apiError";

const emptyNcrRow = (): NcrDocumentRow => ({
  sales_order: "",
  part_no: "",
  part_description: "",
  qty: "",
  issue_description: "",
  disposition: "",
});

const initialNcr: ProjectDocumentRequest = {
  ncr_document_number: "AYENA-QUA-QF-001",
  ncr_revision: "02-06-2026/Rev-00",
  city_operation_in_charge: "",
  project_marshal: "",
  customer_quality_lead: "",
  no_ncr_reported: false,
  ncr_rows: [emptyNcrRow()],
};

const emptyMonthlyProject = (): MonthlyProjectRow => ({
  job_id: null,
  project_name: "",
  handover_date: "",
  days_taken: "",
  learning: "",
});

const now = new Date();
const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
const initialMonthly: MonthlyDocumentRequest = {
  month_year: currentMonth,
  experience_centre: "",
  ops_manager: "",
  team_needed: "",
  trained_team: "",
  training_needed: "",
  projects: [emptyMonthlyProject()],
};

export default function DocumentAutomation() {
  const [searchParams] = useSearchParams();
  const { data: jobs = [], isLoading } = useJobs({ limit: 1000 });
  const completedJobs = jobs.filter((job) => job.status === "completed");
  const requestedJobId = searchParams.get("job") || "";
  const attachProjectReport =
    searchParams.get("attach") === "project-report" &&
    Boolean(Number(requestedJobId));
  const [jobId, setJobId] = useState(requestedJobId);
  const [ncr, setNcr] = useState(initialNcr);
  const [monthly, setMonthly] = useState<MonthlyDocumentRequest>(() => ({
    ...initialMonthly,
    projects: attachProjectReport
      ? [{ ...emptyMonthlyProject(), job_id: Number(requestedJobId) }]
      : [emptyMonthlyProject()],
  }));
  const [ncrLoading, setNcrLoading] = useState(false);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [generatedNcr, setGeneratedNcr] = useState<{
    url: string;
    filename: string;
  } | null>(null);
  const [generatedProjectReport, setGeneratedProjectReport] = useState<{
    url: string;
    filename: string;
  } | null>(null);

  const selectedJob = jobs.find((job) => job.id === Number(jobId));
  const setNcrField = (name: keyof ProjectDocumentRequest, value: string) =>
    setNcr((current) => ({ ...current, [name]: value }));
  const setNcrRow = (
    index: number,
    name: keyof NcrDocumentRow,
    value: string,
  ) =>
    setNcr((current) => ({
      ...current,
      ncr_rows: current.ncr_rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [name]: value } : row,
      ),
    }));

  const submitNcr = async (event: FormEvent) => {
    event.preventDefault();
    if (!jobId) return toast.error("Select a job");
    setNcrLoading(true);
    try {
      const result = await jobAPI.generateNcr(Number(jobId), ncr);
      setGeneratedNcr(result);
      if (result) {
        toast.success("NCR generated and attached to the job");
      } else {
        toast.warning(
          "S3 unavailable: NCR downloaded locally but was not attached to the job",
        );
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "NCR generation failed"));
    } finally {
      setNcrLoading(false);
    }
  };

  const setMonthlyProject = (
    index: number,
    name: keyof MonthlyProjectRow,
    value: string | number,
  ) =>
    setMonthly((current) => ({
      ...current,
      projects: current.projects.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [name]: value } : row,
      ),
    }));

  const submitMonthly = async (event: FormEvent) => {
    event.preventDefault();
    if (
      attachProjectReport &&
      monthly.projects.some((project) => !project.job_id)
    ) {
      return toast.error("Select the project");
    }
    setMonthlyLoading(true);
    try {
      if (attachProjectReport) {
        const result = await jobAPI.generateProjectReport(
          Number(requestedJobId),
          monthly,
        );
        setGeneratedProjectReport(result);
        if (result) {
          toast.success("Project Report generated and attached to the job");
        } else {
          toast.warning(
            "S3 unavailable: Project Report downloaded locally but was not attached to the job",
          );
        }
      } else {
        await jobAPI.downloadMonthlyProjects(monthly);
        toast.success("Monthly workbook generated");
      }
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          attachProjectReport
            ? "Project Report generation failed"
            : "Monthly workbook generation failed",
        ),
      );
    } finally {
      setMonthlyLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">
          Document Automation
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Review and edit document values before generating files in the
          supplied formats.
        </p>
      </header>

      <Tabs
        defaultValue={searchParams.get("tab") === "monthly" ? "monthly" : "ncr"}
      >
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="ncr">
            <FileText /> Level 2 NCR
          </TabsTrigger>
          <TabsTrigger value="monthly">
            <FileSpreadsheet /> Monthly Projects
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ncr">
          <form onSubmit={submitNcr} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Level 2 - NCR</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <Field label="Job" wide>
                  <select
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    value={jobId}
                    onChange={(event) => {
                      setJobId(event.target.value);
                      setGeneratedNcr(null);
                    }}
                    required
                    disabled={isLoading}
                  >
                    <option value="">Select a job</option>
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.name || `Job ${job.id}`} · ID {job.id}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Fetched sales order">
                  <Input
                    value={selectedJob?.sales_order || ""}
                    readOnly
                    placeholder="Not available on job"
                  />
                </Field>
                <Field label="Document number">
                  <Input
                    value={ncr.ncr_document_number}
                    onChange={(event) =>
                      setNcrField("ncr_document_number", event.target.value)
                    }
                  />
                </Field>
                <Field label="Revision date / no.">
                  <Input
                    value={ncr.ncr_revision}
                    onChange={(event) =>
                      setNcrField("ncr_revision", event.target.value)
                    }
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm font-medium md:col-span-2">
                  <input
                    type="checkbox"
                    checked={ncr.no_ncr_reported}
                    onChange={(event) =>
                      setNcr((current) => ({
                        ...current,
                        no_ncr_reported: event.target.checked,
                      }))
                    }
                  />
                  No NCR reported — generate the required report with this
                  statement
                </label>
              </CardContent>
            </Card>

            {!ncr.no_ncr_reported && (
              <Card>
                <CardHeader>
                  <CardTitle>NCR rows</CardTitle>
                  <CardDescription>
                    Enter or override the part details, quantity, issue and
                    disposition.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {ncr.ncr_rows.map((row, index) => (
                    <div
                      key={index}
                      className="grid gap-3 rounded-lg border p-4 md:grid-cols-2 lg:grid-cols-3"
                    >
                      <Field label="Sales order">
                        <Input
                          value={row.sales_order}
                          placeholder="Uses job SO when blank"
                          onChange={(event) =>
                            setNcrRow(index, "sales_order", event.target.value)
                          }
                        />
                      </Field>
                      <Field label="Part no.">
                        <Input
                          value={row.part_no}
                          onChange={(event) =>
                            setNcrRow(index, "part_no", event.target.value)
                          }
                        />
                      </Field>
                      <Field label="Quantity">
                        <Input
                          value={row.qty}
                          onChange={(event) =>
                            setNcrRow(index, "qty", event.target.value)
                          }
                        />
                      </Field>
                      <Field label="Part description">
                        <Textarea
                          value={row.part_description}
                          onChange={(event) =>
                            setNcrRow(
                              index,
                              "part_description",
                              event.target.value,
                            )
                          }
                        />
                      </Field>
                      <Field label="Issue description">
                        <Textarea
                          value={row.issue_description}
                          onChange={(event) =>
                            setNcrRow(
                              index,
                              "issue_description",
                              event.target.value,
                            )
                          }
                        />
                      </Field>
                      <Field label="Disposition">
                        <Textarea
                          value={row.disposition}
                          onChange={(event) =>
                            setNcrRow(index, "disposition", event.target.value)
                          }
                        />
                      </Field>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-fit"
                        disabled={ncr.ncr_rows.length === 1}
                        onClick={() =>
                          setNcr((current) => ({
                            ...current,
                            ncr_rows: current.ncr_rows.filter(
                              (_, i) => i !== index,
                            ),
                          }))
                        }
                      >
                        <Trash2 /> Remove row
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={ncr.ncr_rows.length >= 21}
                    onClick={() =>
                      setNcr((current) => ({
                        ...current,
                        ncr_rows: [...current.ncr_rows, emptyNcrRow()],
                      }))
                    }
                  >
                    <Plus /> Add NCR row
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Names for sign-off</CardTitle>
                <CardDescription>
                  Enter or override the names before generating. Signatures are
                  not collected.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <Field label="City Operation In charge">
                  <Input
                    value={ncr.city_operation_in_charge}
                    onChange={(event) =>
                      setNcrField(
                        "city_operation_in_charge",
                        event.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="Project Marshal">
                  <Input
                    value={ncr.project_marshal}
                    onChange={(event) =>
                      setNcrField("project_marshal", event.target.value)
                    }
                  />
                </Field>
                <Field label="Customer Quality Lead">
                  <Input
                    value={ncr.customer_quality_lead}
                    onChange={(event) =>
                      setNcrField("customer_quality_lead", event.target.value)
                    }
                  />
                </Field>
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={ncrLoading}>
                {ncrLoading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <FileText />
                )}{" "}
                Generate and attach NCR
              </Button>
              {generatedNcr && (
                <Button asChild variant="outline">
                  <a
                    href={generatedNcr.url}
                    download
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Download /> Download report
                  </a>
                </Button>
              )}
            </div>
          </form>
        </TabsContent>

        <TabsContent value="monthly">
          <form onSubmit={submitMonthly} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  {attachProjectReport
                    ? "Project Report"
                    : "Monthly executed projects"}
                </CardTitle>
                <CardDescription>
                  {attachProjectReport
                    ? "Generate and attach this job using the supplied Monthly executed projects workbook. Project ID is fetched; review or override the remaining workbook values."
                    : "Select only projects completed in the chosen month. Project ID is fetched; review or override the remaining workbook values. The supplied format supports eight projects."}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <Field label="Month">
                  <Input
                    type="month"
                    value={monthly.month_year}
                    onChange={(event) =>
                      setMonthly((current) => ({
                        ...current,
                        month_year: event.target.value,
                      }))
                    }
                    required
                  />
                </Field>
                <Field label="Experience Centre">
                  <Input
                    value={monthly.experience_centre}
                    onChange={(event) =>
                      setMonthly((current) => ({
                        ...current,
                        experience_centre: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Ops Manager">
                  <Input
                    value={monthly.ops_manager}
                    onChange={(event) =>
                      setMonthly((current) => ({
                        ...current,
                        ops_manager: event.target.value,
                      }))
                    }
                  />
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {attachProjectReport
                    ? "Project row"
                    : "Completed project rows"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {monthly.projects.map((project, index) => (
                  <div
                    key={index}
                    className="grid gap-3 rounded-lg border p-4 md:grid-cols-2 lg:grid-cols-3"
                  >
                    <Field
                      label={
                        attachProjectReport ? "Project" : "Completed project"
                      }
                    >
                      <select
                        className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                        value={project.job_id || ""}
                        onChange={(event) =>
                          setMonthlyProject(
                            index,
                            "job_id",
                            event.target.value
                              ? Number(event.target.value)
                              : null,
                          )
                        }
                        required={attachProjectReport}
                        disabled={attachProjectReport}
                      >
                        <option value="">
                          {attachProjectReport
                            ? "Select project"
                            : "Not present in dashboard"}
                        </option>
                        {(attachProjectReport ? jobs : completedJobs).map(
                          (job) => (
                            <option key={job.id} value={job.id}>
                              {job.name || `Job ${job.id}`} · ID {job.id}
                            </option>
                          ),
                        )}
                      </select>
                    </Field>
                    <Field label="Project name">
                      <Input
                        value={project.project_name}
                        onChange={(event) =>
                          setMonthlyProject(
                            index,
                            "project_name",
                            event.target.value,
                          )
                        }
                      />
                    </Field>
                    <Field label="Handover date">
                      <Input
                        value={project.handover_date}
                        onChange={(event) =>
                          setMonthlyProject(
                            index,
                            "handover_date",
                            event.target.value,
                          )
                        }
                      />
                    </Field>
                    <Field label="Total days taken">
                      <Input
                        value={project.days_taken}
                        onChange={(event) =>
                          setMonthlyProject(
                            index,
                            "days_taken",
                            event.target.value,
                          )
                        }
                      />
                    </Field>
                    <Field label="Learning" wide>
                      <Textarea
                        value={project.learning}
                        onChange={(event) =>
                          setMonthlyProject(
                            index,
                            "learning",
                            event.target.value,
                          )
                        }
                      />
                    </Field>
                    {!attachProjectReport && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-fit"
                        disabled={monthly.projects.length === 1}
                        onClick={() =>
                          setMonthly((current) => ({
                            ...current,
                            projects: current.projects.filter(
                              (_, i) => i !== index,
                            ),
                          }))
                        }
                      >
                        <Trash2 /> Remove project
                      </Button>
                    )}
                  </div>
                ))}
                {!attachProjectReport && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={monthly.projects.length >= 8}
                    onClick={() =>
                      setMonthly((current) => ({
                        ...current,
                        projects: [...current.projects, emptyMonthlyProject()],
                      }))
                    }
                  >
                    <Plus /> Add completed project
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Team planning</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <Field label="No. of teams needed">
                  <Input
                    value={monthly.team_needed}
                    onChange={(event) =>
                      setMonthly((current) => ({
                        ...current,
                        team_needed: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="No. of trained teams">
                  <Input
                    value={monthly.trained_team}
                    onChange={(event) =>
                      setMonthly((current) => ({
                        ...current,
                        trained_team: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Training needed for new vendor" wide>
                  <Textarea
                    value={monthly.training_needed}
                    onChange={(event) =>
                      setMonthly((current) => ({
                        ...current,
                        training_needed: event.target.value,
                      }))
                    }
                  />
                </Field>
              </CardContent>
            </Card>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" className="w-fit" disabled={monthlyLoading}>
                {monthlyLoading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <FileSpreadsheet />
                )}{" "}
                {attachProjectReport
                  ? "Generate and attach Project Report"
                  : "Generate and download workbook"}
              </Button>
              {generatedProjectReport && (
                <Button asChild variant="outline">
                  <a
                    href={generatedProjectReport.url}
                    download
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Download /> Download Project Report
                  </a>
                </Button>
              )}
            </div>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({
  label,
  wide = false,
  children,
}: Readonly<{
  label: string;
  wide?: boolean;
  children: ReactNode;
}>) {
  return (
    <label className={`block space-y-2 ${wide ? "md:col-span-2" : ""}`}>
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
