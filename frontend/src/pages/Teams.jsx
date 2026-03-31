import { Plus, Users, Eye } from 'lucide-react';

const mockTeams = [
  {
    name: 'SOC Alpha',
    members: 8,
    pin: '****42',
    description: 'Primary security operations center team handling critical alerts.',
  },
  {
    name: 'Incident Response',
    members: 5,
    pin: '****87',
    description: 'Dedicated incident response and forensics team.',
  },
  {
    name: 'Threat Intel',
    members: 3,
    pin: '****15',
    description: 'Threat intelligence gathering and analysis team.',
  },
];

export default function Teams() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Teams</h1>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-all shadow-lg shadow-blue-600/20 cursor-pointer">
          <Plus className="w-4 h-4" />
          Create Team
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {mockTeams.map((team) => (
          <div
            key={team.name}
            className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 hover:border-white/[0.1] transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
            </div>

            <h3 className="text-base font-semibold text-white">{team.name}</h3>
            <p className="mt-1 text-sm text-slate-400 leading-relaxed">{team.description}</p>

            <div className="mt-4 flex items-center gap-4 text-sm">
              <span className="text-slate-500">
                <span className="text-white font-medium">{team.members}</span> members
              </span>
              <span className="text-slate-500">
                PIN: <span className="font-mono text-slate-400">{team.pin}</span>
              </span>
            </div>

            <button className="flex items-center gap-2 mt-4 w-full justify-center px-4 py-2.5 rounded-lg border border-white/[0.08] text-slate-300 hover:text-white hover:bg-white/[0.05] hover:border-white/[0.12] transition-all text-sm font-medium cursor-pointer">
              <Eye className="w-4 h-4" />
              View Members
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
