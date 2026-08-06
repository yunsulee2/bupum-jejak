#include "AssemblyPartComponent.h"

UAssemblyPartComponent::UAssemblyPartComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
}

bool UAssemblyPartComponent::CanInstall(const TSet<FName>& InstalledPartIds) const
{
    return State != EAssemblyPartState::Installed && RequiredPartIds.ContainsByPredicate(
        [&InstalledPartIds](const FName RequiredId)
        {
            return !InstalledPartIds.Contains(RequiredId);
        }) == false;
}

bool UAssemblyPartComponent::BeginInstall(const TSet<FName>& InstalledPartIds)
{
    if (!CanInstall(InstalledPartIds))
    {
        SetState(EAssemblyPartState::Error);
        return false;
    }

    SetState(EAssemblyPartState::Installing);
    return true;
}

void UAssemblyPartComponent::CompleteInstall()
{
    SetState(EAssemblyPartState::Installed);
}

void UAssemblyPartComponent::ResetPart()
{
    SetState(EAssemblyPartState::Pending);
}

void UAssemblyPartComponent::SetState(const EAssemblyPartState NewState)
{
    State = NewState;
    OnStateChanged.Broadcast(PartId, State);
}
