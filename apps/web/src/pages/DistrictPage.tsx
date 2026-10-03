import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BRANCH_GROUP_BY_SLUG } from "@mhtcet/core";
import { api } from "../lib/api";
import { PageHeader, type Crumb } from "../components/PageHeader";
import { Icon } from "../components/Icon";
import { avatarTint, collegeInitials, formatNumber } from "../lib/format";
import { formatInr } from "../lib/plans";
import { usePageMeta } from "../lib/seo";
import {
  collegeRows,
  DISTRICT_HUB_PATH,
  districtIntro,
  districtLabel,
  districtMeta,
  districtPath,
  formatLakh,
  groupIntro,
  groupMeta,
  groupPath,
  groupRows,
  hubMeta,
  noFeeText,
  SOURCES_NOTE,
  type DistrictCollege,
  type DistrictDetail,
  type DistrictSummary,
} from "../lib/districts";
import "./DistrictPage.css";

type Load<T> = { status: "loading" } | { status: "error"; notFound: boolean } | { status: "done"; data: T };

const HUB_CRUMBS: Crumb[] = [{ label: "Colleges", to: "/colleges" }, { label: "By district", to: DISTRICT_HUB_PATH }];

/**
 * District landing pages (SEO): the hub (/engineering-colleges), a district
 * (/engineering-colleges/pune) and a district's branch group (/engineering-colleges/pune/computer-it).
 * The same content is written as plain HTML at build time (scripts/prerender.ts).
 */
export function DistrictPage() {
  const { district, group } = useParams<{ district?: string; group?: string }>();
  const [all, setAll] = useState<Load<{ year: number; districts: DistrictSummary[] }>>({ status: "loading" });
  const [detail, setDetail] = useState<Load<DistrictDetail> | null>(null);

  useEffect(() => {
    api.districts().then(
      (data) => setAll({ status: "done", data }),
      () => setAll({ status: "error", notFound: false }),
    );
  }, []);

  useEffect(() => {
    if (!district) {
      setDetail(null);
      return;
    }
    setDetail({ status: "loading" });
    api.district(district).then(
      (data) => setDetail({ status: "done", data }),
      (err: Error) => setDetail({ status: "error", notFound: / 404$/.test(err.message) }),
    );
  }, [district]);

  if (!district) return <Hub all={all} />;
  const groupName = group ? BRANCH_GROUP_BY_SLUG[group] : undefined;
  if (group && !groupName) return <NotFound />;
  if (!detail || detail.status === "loading") return <Loading />;
  if (detail.status === "error") return detail.notFound ? <NotFound /> : <LoadError />;
  const d = detail.data;
  const others = all.status === "done" ? all.data.districts.filter((x) => x.slug !== d.slug) : [];
  if (groupName) {
    if (!d.groups.some((g) => g.name === groupName)) return <NotFound />;
    return <GroupView d={d} group={groupName} others={others} />;
  }
  return <DistrictView d={d} others={others} />;
}

function Hub({ all }: { all: Load<{ year: number; districts: DistrictSummary[] }> }) {
  usePageMeta(all.status === "done" ? hubMeta(all.data.districts.length, all.data.year) : null);
  if (all.status === "loading") return <Loading />;
  if (all.status === "error") return <LoadError />;
  const { districts, year } = all.data;
  const colleges = districts.reduce((n, d) => n + d.colleges, 0);
  return (
    <div className="page district-page">
      <PageHeader
        breadcrumb={[{ label: "Colleges", to: "/colleges" }, { label: "By district" }]}
        title="Engineering colleges by district"
        subtitle={`${formatNumber(colleges)} colleges across ${districts.length} Maharashtra districts, with closing merit numbers from CAP ${year}`}
      />
      <ul className="dp-hub">
        {districts.map((d) => (
          <li key={d.slug} className="card dp-hub-card">
            <Link to={districtPath(d.slug)} className="dp-hub-name">
              {districtLabel(d.name)}
            </Link>
            <span className="dp-hub-count">
              {d.colleges} {d.colleges === 1 ? "college" : "colleges"} · {d.branches} {d.branches === 1 ? "branch" : "branches"}
            </span>
            {d.groups.length > 0 && (
              <span className="dp-hub-groups">
                {d.groups.slice(0, 3).map((g) => (
                  <Link key={g.slug} to={groupPath(d.slug, g.slug)}>
                    {g.name}
                  </Link>
                ))}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="dp-note">{SOURCES_NOTE}</p>
    </div>
  );
}

function DistrictView({ d, others }: { d: DistrictDetail; others: DistrictSummary[] }) {
  usePageMeta(districtMeta(d));
  const place = districtLabel(d.name);
  const rows = collegeRows(d.colleges);
  return (
    <div className="page district-page">
      <PageHeader breadcrumb={[...HUB_CRUMBS, { label: place }]} title={`Engineering colleges in ${place}`} subtitle={districtIntro(d)} />
      <GroupLinks d={d} />
      <section className="card dp-table-card" aria-labelledby="dp-colleges">
        <div className="card-head">
          <h2 id="dp-colleges">Colleges, lowest closing merit number first</h2>
        </div>
        <div className="table-scroll">
          <table className="dp-table">
            <thead>
              <tr>
                <th scope="col">College</th>
                <th scope="col">Lowest closing, CAP {d.year}</th>
                <th scope="col" className="num">Branches</th>
                <th scope="col" className="num">Fee per year</th>
                <th scope="col" className="num">Median salary</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ college, top }) => (
                <tr key={college.code}>
                  <td className="dp-cell-college"><CollegeCell college={college} /></td>
                  <td data-label={`Lowest closing, CAP ${d.year}`}>
                    <span className="dp-merit">{formatNumber(top.roundI ?? top.latest)}</span>
                    <span className="dp-sub">
                      <Link to={`/colleges/${college.code}/${top.choiceCode}`}>{top.name}</Link>, {top.roundI === null ? "last round" : "Round I"}
                    </span>
                  </td>
                  <td className="num" data-label="Branches">{college.branches.length}</td>
                  <FeeCell college={college} />
                  <SalaryCell college={college} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="dp-note">{SOURCES_NOTE}</p>
      <OtherDistricts others={others} />
    </div>
  );
}

function GroupView({ d, group, others }: { d: DistrictDetail; group: string; others: DistrictSummary[] }) {
  usePageMeta(groupMeta(d, group));
  const place = districtLabel(d.name);
  const rows = groupRows(d.colleges, group);
  return (
    <div className="page district-page">
      <PageHeader
        breadcrumb={[...HUB_CRUMBS, { label: place, to: districtPath(d.slug) }, { label: group }]}
        title={`${group} engineering colleges in ${place}`}
        subtitle={groupIntro(d, group)}
      />
      <GroupLinks d={d} current={group} />
      <section className="card dp-table-card" aria-labelledby="dp-branches">
        <div className="card-head">
          <h2 id="dp-branches">{group} branches, lowest closing merit number first</h2>
        </div>
        <div className="table-scroll">
          <table className="dp-table">
            <thead>
              <tr>
                <th scope="col">College and branch</th>
                <th scope="col" className="num">Round I, CAP {d.year}</th>
                <th scope="col" className="num">Last round</th>
                <th scope="col" className="num">Fee per year</th>
                <th scope="col" className="num">Median salary</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ college, branch }) => (
                <tr key={branch.choiceCode}>
                  <td className="dp-cell-college">
                    <CollegeCell college={college} />
                    <span className="dp-sub dp-branch">
                      <Link to={`/colleges/${college.code}/${branch.choiceCode}`}>{branch.name}</Link>
                    </span>
                  </td>
                  <td className="num" data-label={`Round I, CAP ${d.year}`}><span className="dp-merit">{branch.roundI === null ? "–" : formatNumber(branch.roundI)}</span></td>
                  <td className="num" data-label="Last round">{formatNumber(branch.latest)}</td>
                  <FeeCell college={college} />
                  <SalaryCell college={college} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="dp-note">{SOURCES_NOTE}</p>
      <p className="dp-back">
        <Link to={districtPath(d.slug)} className="btn btn-secondary btn-sm">
          <Icon name="back" size={16} />
          All engineering colleges in {place}
        </Link>
      </p>
      <OtherDistricts others={others.filter((o) => o.groups.some((g) => g.name === group))} group={group} />
    </div>
  );
}

function CollegeCell({ college }: { college: DistrictCollege }) {
  return (
    <span className="dp-college">
      <span className="dp-tile" style={{ background: avatarTint(college.code) }} aria-hidden="true">
        {collegeInitials(college.name, college.code)}
      </span>
      <span>
        <Link to={`/colleges/${college.code}`} className="dp-college-name">{college.name}</Link>
        {college.collegeType && <span className="dp-sub">{college.collegeType}</span>}
      </span>
    </span>
  );
}

function FeeCell({ college }: { college: DistrictCollege }) {
  return (
    <td className="num" data-label="Fee per year">
      {college.fee ? (
        <>
          {formatInr(college.fee.total)}
          <span className="dp-sub">FRA, {college.fee.year}</span>
        </>
      ) : (
        <span className="dp-none">{noFeeText(college.collegeType)}</span>
      )}
    </td>
  );
}

function SalaryCell({ college }: { college: DistrictCollege }) {
  return (
    <td className="num" data-label="Median salary">
      {college.placement ? (
        <>
          {formatLakh(college.placement.medianSalary)}
          <span className="dp-sub">NIRF, batch {college.placement.graduationYear}</span>
        </>
      ) : (
        <span className="dp-none">Not published</span>
      )}
    </td>
  );
}

function GroupLinks({ d, current }: { d: DistrictDetail; current?: string }) {
  if (d.groups.length === 0) return null;
  return (
    <nav className="dp-groups" aria-label={`Branch groups in ${districtLabel(d.name)}`}>
      {d.groups.map((g) =>
        g.name === current ? (
          <span key={g.slug} className="chip dp-group is-current" aria-current="page">
            {g.name} · {g.colleges}
          </span>
        ) : (
          <Link key={g.slug} to={groupPath(d.slug, g.slug)} className="chip dp-group">
            {g.name} · {g.colleges}
          </Link>
        ),
      )}
    </nav>
  );
}

function OtherDistricts({ others, group }: { others: DistrictSummary[]; group?: string }) {
  if (others.length === 0) return null;
  return (
    <section className="dp-others" aria-labelledby="dp-others">
      <h2 id="dp-others">{group ? `${group} colleges in other districts` : "Other districts"}</h2>
      <ul>
        {others.map((o) => {
          const g = group ? o.groups.find((x) => x.name === group) : undefined;
          return (
            <li key={o.slug}>
              <Link to={g ? groupPath(o.slug, g.slug) : districtPath(o.slug)}>{districtLabel(o.name)}</Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Loading() {
  return (
    <div className="page district-page">
      <PageHeader title="Loading colleges…" breadcrumb={HUB_CRUMBS} />
      <div className="dp-skeleton card" aria-busy="true" />
    </div>
  );
}

function NotFound() {
  usePageMeta({ title: "Page not found", noindex: true });
  return (
    <div className="page district-page">
      <PageHeader title="Page not found" breadcrumb={HUB_CRUMBS} />
      <div className="empty-state">
        <p>We have no engineering colleges listed for this district or branch group.</p>
        <Link to={DISTRICT_HUB_PATH} className="btn btn-secondary">
          <Icon name="back" size={16} />
          All districts
        </Link>
      </div>
    </div>
  );
}

function LoadError() {
  return (
    <div className="page district-page">
      <PageHeader title="Couldn't load the colleges" breadcrumb={HUB_CRUMBS} />
      <div className="empty-state">
        <p>The college data didn't load. Check your connection and reload the page.</p>
      </div>
    </div>
  );
}
