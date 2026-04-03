import random
import string

from .models import User


def _generate_pin(length=6):
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=length))


def handle_tier_downgrade_from_exclusive(user):
    """When a user is downgraded from EXCLUSIVE, handle team cleanup.

    - If team leader: dissolve the entire team (remove all members, delete team)
    - If team member: kick them out of the team
    """
    if not user.team:
        return

    team = user.team

    if user.is_team_leader:
        # Dissolve the team — remove all members first
        User.objects.filter(team=team).update(team=None, is_team_leader=False)
        team.delete()
    else:
        # Just remove this member from the team
        user.team = None
        user.save(update_fields=['team'])


def handle_tier_upgrade_to_exclusive(user):
    """When a user is upgraded to EXCLUSIVE, create a team and make them leader."""
    if user.team:
        return  # Already in a team

    from teams.models import Team

    pin = _generate_pin()
    while Team.objects.filter(pin=pin).exists():
        pin = _generate_pin()

    team = Team.objects.create(
        name=f"{user.first_name or user.username}'s Team",
        pin=pin,
        created_by=user,
    )
    user.team = team
    user.is_team_leader = True
    user.save(update_fields=['team', 'is_team_leader'])
