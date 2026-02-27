import { experiences, educations, skillCategories } from "../data/CVData";

function CV() {
  return (
    <div className="container mx-auto px-4 py-24 text-gray-900">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
        <div className="lg:col-span-8">
          <div className="flex items-center gap-4 mb-10">
            <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
              </svg>
            </div>
            <h3 className="text-xl font-bold uppercase tracking-wider">
              Werkervaring
            </h3>
          </div>

          <div className="space-y-12 border-l-[1.5px] border-gray-200 ml-3 pl-8 py-2">
            {experiences.map((exp) => (
              <div key={exp.id} className="relative group">
                <div className="absolute -left-9.75 top-1.5 w-4 h-4 rounded-full bg-white border-[3px] border-gray-300 group-hover:border-black transition-colors"></div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2">
                  <h4 className="text-lg font-bold">{exp.role}</h4>
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 shrink-0 sm:ml-4">
                    {exp.period}
                  </span>
                </div>

                <p className="text-sm font-medium text-gray-700 mb-3">
                  {exp.company} <span className="text-gray-300 mx-1">|</span>{" "}
                  <span className="text-gray-500 font-normal">
                    {exp.type} — {exp.location}
                  </span>
                </p>

                <p className="text-sm text-gray-600 leading-relaxed max-w-2xl">
                  {exp.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-16">
          <div>
            <div className="flex items-center gap-4 mb-10">
              <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                  <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
                </svg>
              </div>
              <h3 className="text-xl font-bold uppercase tracking-wider">
                Opleiding
              </h3>
            </div>

            <div className="space-y-10 border-l-[1.5px] border-gray-200 ml-3 pl-8 py-2">
              {educations.map((edu) => (
                <div key={edu.id} className="relative group">
                  <div className="absolute -left-9.75 top-1.5 w-4 h-4 rounded-full bg-white border-[3px] border-gray-300 group-hover:border-black transition-colors"></div>

                  <h4 className="text-lg font-bold mb-1">{edu.school}</h4>
                  <p className="text-sm font-medium text-gray-800 mb-1">
                    {edu.study}
                  </p>
                  <p className="text-xs text-gray-500 mb-3">
                    {edu.sub} •{" "}
                    <span className="uppercase tracking-wider">
                      {edu.period}
                    </span>
                  </p>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {edu.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div id="skills">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                  <polyline points="2 17 12 22 22 17"></polyline>
                  <polyline points="2 12 12 17 22 12"></polyline>
                </svg>
              </div>
              <h3 className="text-xl font-bold uppercase tracking-wider">
                Skills & Expertise
              </h3>
            </div>

            <div className="space-y-8">
              {skillCategories.map((category, index) => (
                <div key={index}>
                  <h5 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">
                    {category.title}
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {category.skills.map((skill) => (
                      <span
                        key={skill}
                        className="px-3 py-1.5 bg-gray-50 text-gray-700 text-xs font-bold rounded-md border border-gray-100"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CV;
