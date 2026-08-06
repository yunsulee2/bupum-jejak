#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "AssemblyPartComponent.generated.h"

UENUM(BlueprintType)
enum class EAssemblyPartState : uint8
{
    Pending,
    Selected,
    Installing,
    Installed,
    Error
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FAssemblyPartStateChanged, FName, PartId, EAssemblyPartState, NewState);

UCLASS(ClassGroup=(BuildLab), BlueprintType, Blueprintable, meta=(BlueprintSpawnableComponent))
class BUILDLAB_API UAssemblyPartComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UAssemblyPartComponent();

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Assembly")
    FName PartId;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Assembly")
    TArray<FName> RequiredPartIds;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Assembly")
    EAssemblyPartState State = EAssemblyPartState::Pending;

    UPROPERTY(BlueprintAssignable, Category="Assembly")
    FAssemblyPartStateChanged OnStateChanged;

    UFUNCTION(BlueprintPure, Category="Assembly")
    bool CanInstall(const TSet<FName>& InstalledPartIds) const;

    UFUNCTION(BlueprintCallable, Category="Assembly")
    bool BeginInstall(const TSet<FName>& InstalledPartIds);

    UFUNCTION(BlueprintCallable, Category="Assembly")
    void CompleteInstall();

    UFUNCTION(BlueprintCallable, Category="Assembly")
    void ResetPart();

private:
    void SetState(EAssemblyPartState NewState);
};
